/**
 * Feature: full-app-integration
 * Integration tests for PostGIS proximity queries against a real Postgres+PostGIS
 * database. These cover the one thing a mocked pool cannot: ST_DWithin geography
 * behaviour, ST_Distance ordering, and the GIST index path.
 *
 * Run with `npm run test:integration` (needs `docker compose up -d postgres`).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pool from '../db/connection';
import { runMigrations } from '../db/migrate';
import { validateRadius } from './proximityService';
import { getFeedInRadius } from './broadcastService';
import type { GeoPosition } from '../types';

/** Times Square, NYC — the origin every fixture is offset from. */
const ORIGIN = { latitude: 40.758, longitude: -73.9855 };

const center: GeoPosition = { ...ORIGIN, accuracy: 0, timestamp: Date.now() };

/** Tag every fixture row so cleanup never touches unrelated data. */
const TAG = `itest-${process.pid}-${Date.now()}`;

/**
 * Offset a coordinate north by a given number of metres.
 * 1 degree of latitude is ~111,320m, so this is accurate enough for fixtures.
 */
function metresNorth(metres: number) {
  return { latitude: ORIGIN.latitude + metres / 111_320, longitude: ORIGIN.longitude };
}

async function insertUser(label: string): Promise<string> {
  const res = await pool.query(
    `INSERT INTO users (spotify_user_id, encrypted_access_token, encrypted_refresh_token, token_expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
     RETURNING id`,
    [`${TAG}-${label}`, `${TAG}-${label}-access`, `${TAG}-${label}-refresh`],
  );
  return res.rows[0].id;
}

/**
 * Insert a live play under its own session, whose anonymous id is
 * `${TAG}-${label}`. The session is closed so one user can hold several
 * fixtures without tripping the one-open-session index.
 */
async function insertBroadcast(
  userId: string,
  label: string,
  coords: { latitude: number; longitude: number },
  startedSecondsAgo = 0,
): Promise<string> {
  const session = await pool.query(
    `INSERT INTO listening_sessions (user_id, anonymous_id, ended_at)
     VALUES ($1, $2, NOW()) RETURNING id`,
    [userId, `${TAG}-${label}`],
  );
  const res = await pool.query(
    `INSERT INTO broadcasts
       (user_id, session_id, track_id, track_title, artist_name, album_art_url, location, started_at)
     VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
             NOW() - make_interval(secs => $9))
     RETURNING id`,
    [
      userId,
      session.rows[0].id,
      `track-${label}`,
      `Track ${label}`,
      `Artist ${label}`,
      'https://example.test/art.png',
      coords.longitude,
      coords.latitude,
      startedSecondsAgo,
    ],
  );
  return res.rows[0].id;
}

/** Delete only the rows this run created (broadcasts cascade from users). */
async function cleanup() {
  await pool.query('DELETE FROM users WHERE spotify_user_id LIKE $1', [`${TAG}-%`]);
}

beforeAll(async () => {
  await runMigrations();
  await cleanup();
}, 60_000);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

beforeEach(cleanup);

// ============================================================
// ST_DWithin boundary behaviour
// ============================================================

describe('getFeedInRadius — radius boundary', () => {
  it('includes a broadcast well inside the radius', async () => {
    const userId = await insertUser('near');
    await insertBroadcast(userId, 'near', metresNorth(60));

    const results = await getFeedInRadius(center, 200);

    expect(results.map((r) => r.anonymousId)).toContain(`${TAG}-near`);
  });

  it('excludes a broadcast beyond the radius', async () => {
    const userId = await insertUser('far');
    await insertBroadcast(userId, 'far', metresNorth(400));

    const results = await getFeedInRadius(center, 200);

    expect(results.map((r) => r.anonymousId)).not.toContain(`${TAG}-far`);
  });

  it('honours the 500m ceiling — a 600m broadcast is never reachable', async () => {
    const userId = await insertUser('beyond');
    await insertBroadcast(userId, 'beyond', metresNorth(600));

    // Ask for far more than the ceiling; validateRadius clamps it to 500.
    const results = await getFeedInRadius(center, 10_000);

    expect(validateRadius(10_000)).toBe(500);
    expect(results.map((r) => r.anonymousId)).not.toContain(`${TAG}-beyond`);
  });

  it('honours the 50m floor — a request for 5m still reaches 50m', async () => {
    const userId = await insertUser('floor');
    await insertBroadcast(userId, 'floor', metresNorth(40));

    const results = await getFeedInRadius(center, 5);

    expect(results.map((r) => r.anonymousId)).toContain(`${TAG}-floor`);
  });

  it('measures distance as geography metres, not degrees', async () => {
    const userId = await insertUser('measure');
    await insertBroadcast(userId, 'measure', metresNorth(150));

    const [row] = await pool.query(
      `SELECT ST_Distance(b.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS d
       FROM broadcasts b JOIN listening_sessions s ON s.id = b.session_id
       WHERE s.anonymous_id = $3`,
      [ORIGIN.longitude, ORIGIN.latitude, `${TAG}-measure`],
    ).then((r) => r.rows);

    expect(Number(row.d)).toBeGreaterThan(140);
    expect(Number(row.d)).toBeLessThan(160);
  });
});

// ============================================================
// Ordering and exclusion
// ============================================================

describe('getFeedInRadius — ordering and exclusion', () => {
  it('returns plays newest first, regardless of distance', async () => {
    const a = await insertUser('a');
    const b = await insertUser('b');
    const c = await insertUser('c');
    // Nearest is oldest, so a distance sort would get this backwards.
    await insertBroadcast(a, 'oldest', metresNorth(50), 600);
    await insertBroadcast(b, 'newest', metresNorth(350), 10);
    await insertBroadcast(c, 'middle', metresNorth(200), 300);

    const results = (await getFeedInRadius(center, 500)).filter((r) =>
      r.anonymousId.startsWith(TAG),
    );

    expect(results.map((r) => r.anonymousId)).toEqual([
      `${TAG}-newest`,
      `${TAG}-middle`,
      `${TAG}-oldest`,
    ]);
  });

  it('excludes the requesting user own broadcast', async () => {
    const self = await insertUser('self');
    const other = await insertUser('other');
    await insertBroadcast(self, 'self', metresNorth(10));
    await insertBroadcast(other, 'other', metresNorth(20));

    const results = await getFeedInRadius(center, 500, self);

    const ids = results.map((r) => r.anonymousId);
    expect(ids).not.toContain(`${TAG}-self`);
    expect(ids).toContain(`${TAG}-other`);
  });

  it('returns an empty list when nothing is in range', async () => {
    const userId = await insertUser('lonely');
    await insertBroadcast(userId, 'lonely', metresNorth(5_000));

    const results = await getFeedInRadius(center, 500);

    expect(results.map((r) => r.anonymousId)).not.toContain(`${TAG}-lonely`);
  });
});

// ============================================================
// Row mapping
// ============================================================

describe('getFeedInRadius — row mapping', () => {
  it('round-trips the stored coordinates back out of PostGIS', async () => {
    const userId = await insertUser('coords');
    const coords = metresNorth(100);
    await insertBroadcast(userId, 'coords', coords);

    const [row] = (await getFeedInRadius(center, 500)).filter((r) => r.anonymousId === `${TAG}-coords`);

    expect(row.location.latitude).toBeCloseTo(coords.latitude, 5);
    expect(row.location.longitude).toBeCloseTo(coords.longitude, 5);
  });

  it('maps track metadata and numeric timestamps', async () => {
    const userId = await insertUser('meta');
    await insertBroadcast(userId, 'meta', metresNorth(30));

    const [row] = (await getFeedInRadius(center, 500)).filter((r) => r.anonymousId === `${TAG}-meta`);

    expect(row.trackTitle).toBe('Track meta');
    expect(row.artistName).toBe('Artist meta');
    expect(typeof row.startedAt).toBe('number');
    expect(row.startedAt).toBeGreaterThan(0);
    expect(typeof row.createdAt).toBe('number');
  });
});

// ============================================================
// Schema guarantees the mocked tests assume
// ============================================================

describe('schema', () => {
  it('has the GIST index the proximity query relies on', async () => {
    const res = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'broadcasts' AND indexname = 'idx_broadcasts_location'`,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].indexdef).toContain('gist');
  });

  it('cascades broadcast deletion when a user is deleted', async () => {
    const userId = await insertUser('cascade');
    await insertBroadcast(userId, 'cascade', metresNorth(30));

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    const res = await pool.query('SELECT 1 FROM broadcasts WHERE user_id = $1', [userId]);
    expect(res.rows).toHaveLength(0);
  });
});
