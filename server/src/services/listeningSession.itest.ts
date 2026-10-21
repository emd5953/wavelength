/**
 * Feature: listening-sessions-and-recent-feed
 * Integration tests for sessions, the play lifecycle, and the 6h feed window
 * against real Postgres+PostGIS. Spec: docs/specs/listening-sessions-and-recent-feed.md
 *
 * Run with `npm run test:integration` (needs `docker compose up -d postgres`).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import pool from '../db/connection';
import { runMigrations } from '../db/migrate';
import {
  recordPlayback,
  recordNotPlaying,
  getFeedInRadius,
  endStalePlays,
  expireOldPlays,
} from './broadcastService';
import { endIdleSessions, touchPresence, resolveAnonId } from './sessionService';
import { addComment, addReaction, getComments, sendDM, getDMThread } from './socialService';
import { deleteAccount } from './privacyService';
import { notifyRepeatListeners } from './pushService';
import type { CurrentTrack, GeoPosition } from '../types';

const ORIGIN: GeoPosition = { latitude: 40.758, longitude: -73.9855, accuracy: 0, timestamp: 0 };
const TAG = `itest-ls-${process.pid}-${Date.now()}`;

function track(id: string): CurrentTrack {
  return { trackId: `${TAG}-${id}`, title: `Track ${id}`, artist: 'Artist', albumArt: 'https://example.test/a.png', startedAt: Date.now() };
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

/** Move every timestamp on a user's sessions and plays into the past. */
async function age(userId: string, minutes: number) {
  const shift = `make_interval(mins => ${minutes})`;
  await pool.query(
    `UPDATE listening_sessions SET started_at = started_at - ${shift},
       last_playing_at = last_playing_at - ${shift}, ended_at = ended_at - ${shift}
     WHERE user_id = $1`,
    [userId],
  );
  await pool.query(
    `UPDATE broadcasts SET started_at = started_at - ${shift}, created_at = created_at - ${shift},
       last_seen_at = last_seen_at - ${shift}, ended_at = ended_at - ${shift}
     WHERE user_id = $1`,
    [userId],
  );
  await pool.query(
    `UPDATE users SET last_app_seen_at = last_app_seen_at - ${shift} WHERE id = $1`,
    [userId],
  );
}

async function sessionsOf(userId: string) {
  const res = await pool.query(
    `SELECT anonymous_id, ended_at FROM listening_sessions WHERE user_id = $1 ORDER BY started_at`,
    [userId],
  );
  return res.rows as { anonymous_id: string; ended_at: Date | null }[];
}

/** Only this run's plays, so leftover data from other runs can't interfere. */
async function feed(excludeUserId?: string) {
  return (await getFeedInRadius(ORIGIN, 500, excludeUserId)).filter((p) =>
    p.trackId.startsWith(TAG),
  );
}

async function cleanup() {
  await pool.query(
    `DELETE FROM direct_messages WHERE text LIKE $1`,
    [`${TAG}%`],
  );
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
// Play lifecycle
// ============================================================

describe('recordPlayback', () => {
  it('keeps one session across tracks: A then B gives two plays, B live', async () => {
    const u = await insertUser('ab');

    const a = await recordPlayback(u, track('a'), ORIGIN);
    const b = await recordPlayback(u, track('b'), ORIGIN);

    expect(a.change).toBe('started');
    expect(b.change).toBe('started');
    expect(b.endedPlayId).toBe(a.play.id);
    expect(b.play.anonymousId).toBe(a.play.anonymousId);
    expect(await sessionsOf(u)).toHaveLength(1);

    const plays = await feed();
    expect(plays.map((p) => [p.trackId, p.isLive])).toEqual([
      [`${TAG}-b`, true],
      [`${TAG}-a`, false],
    ]);
  });

  it('continues the same play while the same track keeps playing', async () => {
    const u = await insertUser('same');

    const first = await recordPlayback(u, track('a'), ORIGIN);
    const second = await recordPlayback(u, track('a'), ORIGIN);

    expect(second.change).toBe('continued');
    expect(second.play.id).toBe(first.play.id);
    expect(await feed()).toHaveLength(1);
  });

  it('reopens a paused track resumed within 5 minutes instead of duplicating it', async () => {
    const u = await insertUser('resume');

    const first = await recordPlayback(u, track('a'), ORIGIN);
    await recordNotPlaying(u);
    expect((await feed())[0].isLive).toBe(false);

    const resumed = await recordPlayback(u, track('a'), ORIGIN);

    expect(resumed.change).toBe('resumed');
    expect(resumed.play.id).toBe(first.play.id);
    expect(resumed.play.isLive).toBe(true);
    expect(await feed()).toHaveLength(1);
  });

  it('starts a new play when the same track resumes after the 5-minute window', async () => {
    const u = await insertUser('late');

    const first = await recordPlayback(u, track('a'), ORIGIN);
    await recordNotPlaying(u);
    await age(u, 6);
    // Keep the session open: the user is still in the app.
    await pool.query('UPDATE users SET last_app_seen_at = NOW() WHERE id = $1', [u]);

    const later = await recordPlayback(u, track('a'), ORIGIN);

    expect(later.change).toBe('started');
    expect(later.play.id).not.toBe(first.play.id);
    expect(await feed()).toHaveLength(2);
  });

  it('keeps reactions and comments on a play after the next track starts', async () => {
    const listener = await insertUser('listener');
    const viewer = await insertUser('viewer');
    const { anonymousId: viewerAnon } = await touchPresence(viewer);

    const a = await recordPlayback(listener, track('a'), ORIGIN);
    await addReaction(a.play.id, viewerAnon, 'fire');
    await addComment(a.play.id, viewerAnon, 'great pick');
    await recordPlayback(listener, track('b'), ORIGIN);

    const comments = await getComments(a.play.id);
    expect(comments.map((c) => c.text)).toEqual(['great pick']);
    expect(comments[0].authorAnonId).toBe(viewerAnon);
  });
});

// ============================================================
// Feed window and scheduler rules
// ============================================================

describe('feed window', () => {
  it('shows plays ended within 6h, hides older ones, and excludes the viewer', async () => {
    const recent = await insertUser('recent');
    const old = await insertUser('old');
    const self = await insertUser('self');

    await recordPlayback(recent, track('recent'), ORIGIN);
    await recordNotPlaying(recent);
    await age(recent, 5 * 60);

    await recordPlayback(old, track('old'), ORIGIN);
    await recordNotPlaying(old);
    await age(old, 6 * 60 + 5);

    await recordPlayback(self, track('self'), ORIGIN);

    const ids = (await feed(self)).map((p) => p.trackId);
    expect(ids).toEqual([`${TAG}-recent`]);
  });

  it('puts live plays before recent ones even when the recent one started later', async () => {
    const liveUser = await insertUser('live');
    const recentUser = await insertUser('recentlater');

    await recordPlayback(liveUser, track('live'), ORIGIN);
    await age(liveUser, 10);
    await pool.query('UPDATE broadcasts SET last_seen_at = NOW() WHERE user_id = $1', [liveUser]);

    await recordPlayback(recentUser, track('ended'), ORIGIN);
    await recordNotPlaying(recentUser);

    expect((await feed()).map((p) => p.trackId)).toEqual([`${TAG}-live`, `${TAG}-ended`]);
  });

  it('expireOldPlays deletes plays ended over 6h ago, with their comments', async () => {
    const u = await insertUser('expire');
    const v = await insertUser('expirev');
    const { anonymousId } = await touchPresence(v);

    const { play } = await recordPlayback(u, track('x'), ORIGIN);
    await addComment(play.id, anonymousId, 'gone soon');
    await recordNotPlaying(u);
    await age(u, 6 * 60 + 1);

    expect(await expireOldPlays()).toBeGreaterThanOrEqual(1);
    expect(await getComments(play.id)).toEqual([]);
  });

  it('endStalePlays ends a live play the poller stopped confirming', async () => {
    const u = await insertUser('stale');
    await recordPlayback(u, track('s'), ORIGIN);
    await pool.query(
      `UPDATE broadcasts SET last_seen_at = NOW() - INTERVAL '2 minutes' WHERE user_id = $1`,
      [u],
    );

    await endStalePlays();

    const [p] = await feed();
    expect(p.isLive).toBe(false);
  });
});

describe('endIdleSessions', () => {
  async function stoppedListener(label: string) {
    const u = await insertUser(label);
    await recordPlayback(u, track(label), ORIGIN);
    await recordNotPlaying(u);
    await pool.query('UPDATE users SET last_app_seen_at = NOW() WHERE id = $1', [u]);
    return u;
  }

  it('ends a session once the user stopped playing AND left the app 5+ min ago', async () => {
    const u = await stoppedListener('idle');
    await age(u, 6);

    await endIdleSessions();

    expect((await sessionsOf(u))[0].ended_at).not.toBeNull();
  });

  it('keeps the session while the app is still open', async () => {
    const u = await stoppedListener('inapp');
    await age(u, 6);
    await pool.query('UPDATE users SET last_app_seen_at = NOW() WHERE id = $1', [u]);

    await endIdleSessions();

    expect((await sessionsOf(u))[0].ended_at).toBeNull();
  });

  it('keeps the session while music is still playing, even with the app closed', async () => {
    const u = await insertUser('playing');
    await recordPlayback(u, track('p'), ORIGIN);
    await age(u, 30);
    await pool.query('UPDATE broadcasts SET last_seen_at = NOW() WHERE user_id = $1', [u]);

    await endIdleSessions();

    expect((await sessionsOf(u))[0].ended_at).toBeNull();
  });

  it('gives the next session a new anonymous id; old plays keep the old one', async () => {
    const u = await stoppedListener('rotate');
    await age(u, 6);
    await endIdleSessions();

    const next = await recordPlayback(u, track('next'), ORIGIN);

    const sessions = await sessionsOf(u);
    expect(sessions).toHaveLength(2);
    expect(next.play.anonymousId).toBe(sessions[1].anonymous_id);
    expect(next.play.anonymousId).not.toBe(sessions[0].anonymous_id);
  });
});

// ============================================================
// Identity: presence, DMs, deletion
// ============================================================

describe('identity', () => {
  it('touchPresence returns the same anonymous id while the session is open', async () => {
    const u = await insertUser('presence');

    const first = await touchPresence(u);
    const second = await touchPresence(u);
    const play = await recordPlayback(u, track('p'), ORIGIN);

    expect(second.anonymousId).toBe(first.anonymousId);
    expect(play.play.anonymousId).toBe(first.anonymousId);
    await expect(resolveAnonId(first.anonymousId)).resolves.toBe(u);
  });

  it('a DM thread is visible to both participants and to nobody else', async () => {
    const a = await insertUser('dma');
    const b = await insertUser('dmb');
    const outsider = await insertUser('dmout');
    const { anonymousId: aAnon } = await touchPresence(a);
    const { anonymousId: bAnon } = await touchPresence(b);

    await sendDM(aAnon, bAnon, `${TAG} hi`);
    await sendDM(bAnon, aAnon, `${TAG} hey`);

    expect((await getDMThread(a, bAnon)).map((m) => m.text)).toEqual([`${TAG} hi`, `${TAG} hey`]);
    expect((await getDMThread(b, aAnon)).map((m) => m.text)).toEqual([`${TAG} hi`, `${TAG} hey`]);
    expect(await getDMThread(outsider, bAnon)).toEqual([]);
    expect(await getDMThread(outsider, aAnon)).toEqual([]);
  });

  it('account deletion removes DMs from every session the user held', async () => {
    const u = await insertUser('del');
    const other = await insertUser('delother');
    const { anonymousId: otherAnon } = await touchPresence(other);

    const { anonymousId: firstAnon } = await touchPresence(u);
    await sendDM(firstAnon, otherAnon, `${TAG} from first session`);
    await pool.query('UPDATE listening_sessions SET ended_at = NOW() WHERE user_id = $1', [u]);
    const { anonymousId: secondAnon } = await touchPresence(u);
    await sendDM(secondAnon, otherAnon, `${TAG} from second session`);

    await deleteAccount(u);

    const left = await pool.query(
      'SELECT 1 FROM direct_messages WHERE sender_anon_id = ANY($1)',
      [[firstAnon, secondAnon]],
    );
    expect(left.rows).toHaveLength(0);
  });
});

// ============================================================
// On-repeat push
// ============================================================

describe('notifyRepeatListeners', () => {
  const sent = vi.fn();

  beforeEach(() => {
    sent.mockReset();
    // Never reach the real Expo push API from a test
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      sent(JSON.parse(init.body));
      return new Response('{}');
    });
  });

  afterAll(() => vi.unstubAllGlobals());

  /** A user at `coords` with a push token and `trackIds` on repeat. */
  async function fan(label: string, trackIds: string[], coords = ORIGIN, token: string | null = `ExponentPushToken[${label}]`) {
    const u = await insertUser(label);
    await pool.query(
      'UPDATE users SET push_token = $1, last_latitude = $2, last_longitude = $3 WHERE id = $4',
      [token, coords.latitude, coords.longitude, u],
    );
    for (const [i, id] of trackIds.entries()) {
      await pool.query(
        'INSERT INTO user_repeat_tracks (user_id, track_id, rank) VALUES ($1, $2, $3)',
        [u, `${TAG}-${id}`, i + 1],
      );
    }
    return u;
  }

  it('notifies once per (recipient, listener, track), and again for a different listener', async () => {
    await fan('fan', ['song']);
    const first = await insertUser('first');
    const second = await insertUser('second');

    const a = await recordPlayback(first, track('song'), ORIGIN);
    expect(await notifyRepeatListeners(first, a.play)).toBe(1);

    // Same person plays it again later, even in a new session: silent
    await recordNotPlaying(first);
    await pool.query('UPDATE listening_sessions SET ended_at = NOW() WHERE user_id = $1', [first]);
    const again = await recordPlayback(first, track('song'), ORIGIN);
    expect(await notifyRepeatListeners(first, again.play)).toBe(0);

    // A different person playing it: notifies
    const b = await recordPlayback(second, track('song'), ORIGIN);
    expect(await notifyRepeatListeners(second, b.play)).toBe(1);

    expect(sent).toHaveBeenCalledTimes(2);
    expect(sent.mock.calls[0][0][0].body).toContain('Track song');
  });

  it('skips users without the track on repeat, out of range, or without a push token', async () => {
    await fan('other-taste', ['different-song']);
    await fan('far', ['song'], { ...ORIGIN, latitude: ORIGIN.latitude + 0.01 }); // ~1.1km north
    await fan('no-token', ['song'], ORIGIN, null);
    const listener = await insertUser('l');

    const { play } = await recordPlayback(listener, track('song'), ORIGIN);

    expect(await notifyRepeatListeners(listener, play)).toBe(0);
    expect(sent).not.toHaveBeenCalled();
  });

  it('never notifies the listener about their own play', async () => {
    const self = await fan('self-fan', ['song']);

    const { play } = await recordPlayback(self, track('song'), ORIGIN);

    expect(await notifyRepeatListeners(self, play)).toBe(0);
  });
});
