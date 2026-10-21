/**
 * BroadcastService — play lifecycle.
 *
 * A "broadcast" row is one play: one track, one listener, one place. Plays are
 * updated in place while the track keeps playing, marked ended when it stops,
 * and stay in the feed for PLAY_RETENTION_HOURS after ending. The anonymous id
 * comes from the listener's session, so it is shared across their plays.
 */

import pool from '../db/connection';
import { getOrCreateOpenSession, PLAY_RETENTION_HOURS } from './sessionService';
import { validateRadius } from './proximityService';
import type { Broadcast, CurrentTrack, GeoPosition } from '../types';

/** A paused track resumed within this window reopens its play instead of starting a new one. */
export const RESUME_WINDOW_MINUTES = 5;

/** A live play the poller hasn't confirmed for this long is treated as ended. */
export const STALE_PLAY_SECONDS = 60;

export type PlaybackChange = 'started' | 'resumed' | 'continued';

export interface PlaybackResult {
  play: Broadcast;
  change: PlaybackChange;
  /** The play this one replaced, if a different track was live. */
  endedPlayId: string | null;
}

const PLAY_COLUMNS = `
  b.id,
  b.user_id AS "userId",
  s.anonymous_id AS "anonymousId",
  b.track_id AS "trackId",
  b.track_title AS "trackTitle",
  b.artist_name AS "artistName",
  b.album_art_url AS "albumArtUrl",
  EXTRACT(EPOCH FROM b.started_at) * 1000 AS "startedAt",
  ST_Y(b.location::geometry) AS "latitude",
  ST_X(b.location::geometry) AS "longitude",
  EXTRACT(EPOCH FROM b.created_at) * 1000 AS "createdAt",
  EXTRACT(EPOCH FROM b.ended_at) * 1000 AS "endedAt"
`;

function toPlay(row: Record<string, unknown>): Broadcast {
  return {
    id: row.id as string,
    userId: row.userId as string,
    anonymousId: row.anonymousId as string,
    trackId: row.trackId as string,
    trackTitle: row.trackTitle as string,
    artistName: row.artistName as string,
    albumArtUrl: row.albumArtUrl as string,
    startedAt: Number(row.startedAt),
    location: {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracy: 0,
      timestamp: 0,
    },
    createdAt: Number(row.createdAt),
    isLive: row.endedAt == null,
    endedAt: row.endedAt == null ? null : Number(row.endedAt),
  };
}

async function getPlay(playId: string): Promise<Broadcast> {
  const result = await pool.query(
    `SELECT ${PLAY_COLUMNS}
     FROM broadcasts b JOIN listening_sessions s ON s.id = b.session_id
     WHERE b.id = $1`,
    [playId],
  );
  return toPlay(result.rows[0]);
}

/**
 * Record that a user is playing `track`. Continues, resumes, or starts a play
 * in the user's open session (opening one if needed).
 */
export async function recordPlayback(
  userId: string,
  track: CurrentTrack,
  location: GeoPosition,
): Promise<PlaybackResult> {
  const session = await getOrCreateOpenSession(userId);
  await pool.query('UPDATE listening_sessions SET last_playing_at = NOW() WHERE id = $1', [
    session.id,
  ]);

  const latest = await pool.query(
    `SELECT id, track_id AS "trackId",
            ended_at IS NULL AS "isLive",
            ended_at > NOW() - make_interval(mins => $2) AS "resumable"
     FROM broadcasts WHERE session_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [session.id, RESUME_WINDOW_MINUTES],
  );
  const last = latest.rows[0] as
    | { id: string; trackId: string; isLive: boolean; resumable: boolean | null }
    | undefined;

  if (last && last.trackId === track.trackId && (last.isLive || last.resumable)) {
    await pool.query(
      'UPDATE broadcasts SET ended_at = NULL, last_seen_at = NOW() WHERE id = $1',
      [last.id],
    );
    return {
      play: await getPlay(last.id),
      change: last.isLive ? 'continued' : 'resumed',
      endedPlayId: null,
    };
  }

  const ended = await pool.query(
    `UPDATE broadcasts SET ended_at = NOW()
     WHERE session_id = $1 AND ended_at IS NULL
     RETURNING id`,
    [session.id],
  );

  const inserted = await pool.query(
    `INSERT INTO broadcasts
       (user_id, session_id, track_id, track_title, artist_name, album_art_url, location, started_at)
     VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9)
     RETURNING id`,
    [
      userId,
      session.id,
      track.trackId,
      track.title,
      track.artist,
      track.albumArt,
      location.longitude,
      location.latitude,
      new Date(track.startedAt).toISOString(),
    ],
  );

  return {
    play: await getPlay(inserted.rows[0].id),
    change: 'started',
    endedPlayId: ended.rows[0]?.id ?? null,
  };
}

/**
 * Record that a user is not playing. Ends their live play, which stays in the
 * feed as recently played. The session stays open. Returns ended play ids.
 */
export async function recordNotPlaying(userId: string): Promise<string[]> {
  const result = await pool.query(
    `UPDATE broadcasts SET ended_at = NOW()
     WHERE user_id = $1 AND ended_at IS NULL
     RETURNING id`,
    [userId],
  );
  return result.rows.map((r: { id: string }) => r.id);
}

/**
 * Plays within a radius that are live or ended within the retention window,
 * excluding one user's own. Live first, then newest first.
 */
export async function getFeedInRadius(
  location: GeoPosition,
  radiusMeters: number,
  excludeUserId?: string,
): Promise<Broadcast[]> {
  const params: (string | number)[] = [
    location.longitude,
    location.latitude,
    validateRadius(radiusMeters),
    PLAY_RETENTION_HOURS,
  ];
  if (excludeUserId) params.push(excludeUserId);

  const result = await pool.query(
    `SELECT ${PLAY_COLUMNS}
     FROM broadcasts b JOIN listening_sessions s ON s.id = b.session_id
     WHERE ST_DWithin(b.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       AND (b.ended_at IS NULL OR b.ended_at > NOW() - make_interval(hours => $4))
       ${excludeUserId ? 'AND b.user_id != $5' : ''}
     ORDER BY (b.ended_at IS NULL) DESC, b.started_at DESC`,
    params,
  );
  return result.rows.map(toPlay);
}

/**
 * End live plays the poller hasn't confirmed recently (poller failure,
 * revoked token, restart). Ended at the last time they were seen.
 */
export async function endStalePlays(): Promise<string[]> {
  const result = await pool.query(
    `UPDATE broadcasts SET ended_at = last_seen_at
     WHERE ended_at IS NULL AND last_seen_at < NOW() - make_interval(secs => $1)
     RETURNING id`,
    [STALE_PLAY_SECONDS],
  );
  return result.rows.map((r: { id: string }) => r.id);
}

/**
 * Delete plays that ended more than PLAY_RETENTION_HOURS ago. Reactions and
 * comments go with them (ON DELETE CASCADE). Live plays are never deleted.
 */
export async function expireOldPlays(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM broadcasts WHERE ended_at < NOW() - make_interval(hours => $1)`,
    [PLAY_RETENTION_HOURS],
  );
  return result.rowCount ?? 0;
}
