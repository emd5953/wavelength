/**
 * Feature: connection-request-flow
 * Integration tests for the connection request handshake against real Postgres.
 *
 * This is the layer that catches what mocks cannot. The original defect —
 * passing a VARCHAR anonymous id into `connection_requests.broadcaster_user_id
 * UUID` — is invisible to a mocked pool, which accepts any string. Here it
 * surfaces as Postgres error 22P02.
 *
 * Run with `npm run test:integration` (needs `docker compose up -d postgres`).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pool from '../db/connection';
import { runMigrations } from '../db/migrate';
import {
  resolveAnonId,
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getConnections,
  expireStaleRequests,
  NotEntitledError,
  RequestNotFoundError,
  RequestStateError,
} from './connectionService';

const ORIGIN = { latitude: 40.758, longitude: -73.9855 };
const TAG = `itest-cr-${process.pid}-${Date.now()}`;

async function insertUser(label: string): Promise<string> {
  const res = await pool.query(
    `INSERT INTO users (spotify_user_id, encrypted_access_token, encrypted_refresh_token, token_expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
     RETURNING id`,
    [`${TAG}-${label}`, `${TAG}-${label}-access`, `${TAG}-${label}-refresh`],
  );
  return res.rows[0].id;
}

/** Insert a live broadcast and return its anonymous id, as the feed would expose it. */
async function insertBroadcast(userId: string, label: string): Promise<string> {
  const anonymousId = `${TAG}-anon-${label}`;
  await pool.query(
    `INSERT INTO broadcasts (user_id, anonymous_id, track_title, artist_name, album_art_url, location, started_at)
     VALUES ($1, $2, 'Teardrop', 'Massive Attack', 'https://example.test/a.png',
             ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, NOW())`,
    [userId, anonymousId, ORIGIN.longitude, ORIGIN.latitude],
  );
  return anonymousId;
}

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

/** A viewer, a broadcaster, and the broadcaster's live anon id. */
async function pair() {
  const viewer = await insertUser('viewer');
  const broadcaster = await insertUser('broadcaster');
  const anonId = await insertBroadcast(broadcaster, 'b');
  return { viewer, broadcaster, anonId };
}

// ============================================================
// Anon id resolution — the original defect
// ============================================================

describe('resolveAnonId', () => {
  it('resolves a live broadcast anon id to its broadcaster', async () => {
    const { broadcaster, anonId } = await pair();

    await expect(resolveAnonId(anonId)).resolves.toBe(broadcaster);
  });

  it('returns null once the broadcast has ended', async () => {
    const { anonId } = await pair();
    await pool.query('DELETE FROM broadcasts WHERE anonymous_id = $1', [anonId]);

    await expect(resolveAnonId(anonId)).resolves.toBeNull();
  });

  it('returns null for an anon id that never existed', async () => {
    await expect(resolveAnonId('no-such-anon-id')).resolves.toBeNull();
  });

  it('regression: an unresolved anon id is rejected by the UUID column', async () => {
    const { viewer, anonId } = await pair();

    // This is exactly what the route used to do. A mocked pool accepts it;
    // Postgres does not.
    await expect(sendRequest(viewer, anonId)).rejects.toMatchObject({ code: '22P02' });
  });
});

// ============================================================
// Sending
// ============================================================

describe('sendRequest', () => {
  it('writes a pending row with a 24h expiry once the anon id is resolved', async () => {
    const { viewer, broadcaster, anonId } = await pair();
    const resolved = await resolveAnonId(anonId);

    const req = await sendRequest(viewer, resolved!);

    expect(req.status).toBe('pending');
    expect(req.expiresAt).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);

    const row = await pool.query(
      'SELECT viewer_user_id, broadcaster_user_id, status FROM connection_requests WHERE id = $1',
      [req.id],
    );
    expect(row.rows[0].viewer_user_id).toBe(viewer);
    expect(row.rows[0].broadcaster_user_id).toBe(broadcaster);
  });

  it('refuses a duplicate pending request', async () => {
    const { viewer, broadcaster } = await pair();
    await sendRequest(viewer, broadcaster);

    await expect(sendRequest(viewer, broadcaster)).rejects.toBeInstanceOf(RequestStateError);

    const count = await pool.query(
      'SELECT COUNT(*)::int AS c FROM connection_requests WHERE viewer_user_id = $1',
      [viewer],
    );
    expect(count.rows[0].c).toBe(1);
  });

  it('allows a fresh request after the previous one was declined', async () => {
    const { viewer, broadcaster } = await pair();
    const first = await sendRequest(viewer, broadcaster);
    await declineRequest(first.id, broadcaster);

    await expect(sendRequest(viewer, broadcaster)).resolves.toMatchObject({ status: 'pending' });
  });

  it('refuses a request to yourself', async () => {
    const { viewer } = await pair();

    await expect(sendRequest(viewer, viewer)).rejects.toBeInstanceOf(RequestStateError);
  });
});

// ============================================================
// Entitlement
// ============================================================

describe('entitlement', () => {
  it('lets the broadcaster accept', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);

    const connection = await acceptRequest(req.id, broadcaster);

    expect(connection.userAId).toBe(viewer);
    expect(connection.userBId).toBe(broadcaster);
  });

  it('refuses to let the viewer accept their own request', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);

    await expect(acceptRequest(req.id, viewer)).rejects.toBeInstanceOf(NotEntitledError);

    const row = await pool.query('SELECT status FROM connection_requests WHERE id = $1', [req.id]);
    expect(row.rows[0].status).toBe('pending');
  });

  it('refuses to let an unrelated user accept', async () => {
    const { viewer, broadcaster } = await pair();
    const stranger = await insertUser('stranger');
    const req = await sendRequest(viewer, broadcaster);

    await expect(acceptRequest(req.id, stranger)).rejects.toBeInstanceOf(NotEntitledError);
  });

  it('lets the viewer cancel but not the broadcaster', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);

    await expect(cancelRequest(req.id, broadcaster)).rejects.toBeInstanceOf(NotEntitledError);
    await expect(cancelRequest(req.id, viewer)).resolves.toBeUndefined();

    const row = await pool.query('SELECT status FROM connection_requests WHERE id = $1', [req.id]);
    expect(row.rows[0].status).toBe('cancelled');
  });

  it('lets the broadcaster decline but not the viewer', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);

    await expect(declineRequest(req.id, viewer)).rejects.toBeInstanceOf(NotEntitledError);
    await expect(declineRequest(req.id, broadcaster)).resolves.toBeUndefined();
  });

  it('raises RequestNotFoundError for an unknown request id', async () => {
    const stranger = await insertUser('stranger');

    await expect(
      acceptRequest('00000000-0000-4000-8000-000000000000', stranger),
    ).rejects.toBeInstanceOf(RequestNotFoundError);
  });
});

// ============================================================
// State transitions
// ============================================================

describe('state transitions', () => {
  it('refuses to accept an already-accepted request', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);
    await acceptRequest(req.id, broadcaster);

    await expect(acceptRequest(req.id, broadcaster)).rejects.toBeInstanceOf(RequestStateError);
  });

  it('refuses to accept a cancelled request', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);
    await cancelRequest(req.id, viewer);

    await expect(acceptRequest(req.id, broadcaster)).rejects.toBeInstanceOf(RequestStateError);
  });

  it('refuses to accept an expired request', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);
    await pool.query(`UPDATE connection_requests SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [req.id]);

    await expireStaleRequests();

    await expect(acceptRequest(req.id, broadcaster)).rejects.toBeInstanceOf(RequestStateError);
  });
});

// ============================================================
// Listings and the full round trip
// ============================================================

describe('listings', () => {
  it('shows the request as outgoing for the viewer and incoming for the broadcaster', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);

    const outgoing = await getOutgoingRequests(viewer);
    const incoming = await getIncomingRequests(broadcaster);

    expect(outgoing.map((r) => r.id)).toContain(req.id);
    expect(incoming.map((r) => r.id)).toContain(req.id);
    // And not the other way around.
    expect((await getIncomingRequests(viewer)).map((r) => r.id)).not.toContain(req.id);
    expect((await getOutgoingRequests(broadcaster)).map((r) => r.id)).not.toContain(req.id);
  });

  it('returns numeric timestamps, not strings', async () => {
    const { viewer, broadcaster } = await pair();
    await sendRequest(viewer, broadcaster);

    const [row] = await getOutgoingRequests(viewer);

    expect(typeof row.createdAt).toBe('number');
    expect(typeof row.expiresAt).toBe('number');
    expect(row.expiresAt).toBeGreaterThan(row.createdAt);
  });

  it('completes the round trip: send, accept, both see the connection', async () => {
    const { viewer, broadcaster, anonId } = await pair();

    const resolved = await resolveAnonId(anonId);
    const req = await sendRequest(viewer, resolved!);
    await acceptRequest(req.id, broadcaster);

    const viewerSide = await getConnections(viewer);
    const broadcasterSide = await getConnections(broadcaster);

    expect(viewerSide).toHaveLength(1);
    expect(broadcasterSide).toHaveLength(1);
    expect(viewerSide[0].connectedUserId).toBe(broadcaster);
    expect(broadcasterSide[0].connectedUserId).toBe(viewer);
    expect(viewerSide[0].id).toBe(broadcasterSide[0].id);
  });

  it('leaves no connection behind when a request is declined', async () => {
    const { viewer, broadcaster } = await pair();
    const req = await sendRequest(viewer, broadcaster);

    await declineRequest(req.id, broadcaster);

    await expect(getConnections(viewer)).resolves.toHaveLength(0);
    await expect(getConnections(broadcaster)).resolves.toHaveLength(0);
  });
});
