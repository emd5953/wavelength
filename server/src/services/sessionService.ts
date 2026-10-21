/**
 * SessionService — listening sessions and the anonymous ids they carry.
 *
 * A session is a user's anonymous identity for one stretch of activity. It is
 * opened by playback (the poller) or by the app being open (presence), and it
 * ends once the user has both stopped playing and been away from the app for
 * SESSION_IDLE_MINUTES. Every anonymous id the server hands out belongs to a
 * session; clients never choose their own.
 */

import { randomUUID } from 'crypto';
import pool from '../db/connection';

export const SESSION_IDLE_MINUTES = 5;

/** How long a play stays in the feed after it ends. */
export const PLAY_RETENTION_HOURS = 6;

export interface OpenSession {
  id: string;
  anonymousId: string;
}

/**
 * Return the user's open session, creating one if none exists.
 * The partial unique index on (user_id) WHERE ended_at IS NULL makes the
 * insert race-safe: a concurrent creator loses the conflict and re-reads.
 */
export async function getOrCreateOpenSession(userId: string): Promise<OpenSession> {
  const existing = await pool.query(
    `SELECT id, anonymous_id AS "anonymousId"
     FROM listening_sessions WHERE user_id = $1 AND ended_at IS NULL`,
    [userId],
  );
  if (existing.rowCount && existing.rowCount > 0) return existing.rows[0];

  const inserted = await pool.query(
    `INSERT INTO listening_sessions (user_id, anonymous_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) WHERE ended_at IS NULL DO NOTHING
     RETURNING id, anonymous_id AS "anonymousId"`,
    [userId, randomUUID()],
  );
  if (inserted.rowCount && inserted.rowCount > 0) return inserted.rows[0];

  const raced = await pool.query(
    `SELECT id, anonymous_id AS "anonymousId"
     FROM listening_sessions WHERE user_id = $1 AND ended_at IS NULL`,
    [userId],
  );
  return raced.rows[0];
}

/**
 * Record that the app is open. Keeps (or opens) the user's session.
 */
export async function touchPresence(userId: string): Promise<{ anonymousId: string }> {
  await pool.query('UPDATE users SET last_app_seen_at = NOW() WHERE id = $1', [userId]);
  const session = await getOrCreateOpenSession(userId);
  return { anonymousId: session.anonymousId };
}

/**
 * End sessions whose user has stopped playing AND been away from the app
 * for SESSION_IDLE_MINUTES. Returns the number of sessions ended.
 */
export async function endIdleSessions(): Promise<number> {
  const result = await pool.query(
    `UPDATE listening_sessions s
     SET ended_at = NOW()
     FROM users u
     WHERE s.user_id = u.id
       AND s.ended_at IS NULL
       AND COALESCE(s.last_playing_at, s.started_at) < NOW() - make_interval(mins => $1)
       AND COALESCE(u.last_app_seen_at, '-infinity'::timestamptz) < NOW() - make_interval(mins => $1)
       AND NOT EXISTS (
         SELECT 1 FROM broadcasts b WHERE b.session_id = s.id AND b.ended_at IS NULL
       )`,
    [SESSION_IDLE_MINUTES],
  );
  return result.rowCount ?? 0;
}

/**
 * Resolve an anonymous id to its user, if the session is still addressable:
 * open, or with a play still inside the feed window.
 */
export async function resolveAnonId(anonymousId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT s.user_id AS "userId"
     FROM listening_sessions s
     WHERE s.anonymous_id = $1
       AND (
         s.ended_at IS NULL
         OR EXISTS (
           -- Same window as the feed, so an id stops resolving the moment its
           -- last play leaves the feed, not when the scheduler deletes it
           SELECT 1 FROM broadcasts b
           WHERE b.session_id = s.id
             AND (b.ended_at IS NULL OR b.ended_at > NOW() - make_interval(hours => $2))
         )
       )`,
    [anonymousId, PLAY_RETENTION_HOURS],
  );
  return result.rowCount === 0 ? null : (result.rows[0].userId as string);
}

/** Every anonymous id the user has held, for DM threads and account deletion. */
export async function anonIdsForUser(userId: string): Promise<string[]> {
  const result = await pool.query(
    'SELECT anonymous_id FROM listening_sessions WHERE user_id = $1',
    [userId],
  );
  return result.rows.map((r: { anonymous_id: string }) => r.anonymous_id);
}
