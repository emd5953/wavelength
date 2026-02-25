/**
 * BroadcastService — anonymous broadcast lifecycle management.
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import { randomUUID } from 'crypto';
import pool from '../db/connection';
import type { Broadcast, CurrentTrack, GeoPosition } from '../types';

/**
 * Create an anonymous broadcast for a user.
 * Generates a temporary anonymous ID that cannot be traced back to the user.
 * If the user already has a broadcast, it is replaced (upsert behavior).
 */
export async function createBroadcast(
  userId: string,
  track: CurrentTrack,
  location: GeoPosition,
): Promise<Broadcast> {
  // Remove any existing broadcast for this user first
  await removeBroadcast(userId);

  const anonymousId = randomUUID();
  const startedAt = new Date(track.startedAt).toISOString();

  const query = `
    INSERT INTO broadcasts (user_id, anonymous_id, track_title, artist_name, album_art_url, location, started_at)
    VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8)
    RETURNING
      id,
      anonymous_id AS "anonymousId",
      track_title AS "trackTitle",
      artist_name AS "artistName",
      album_art_url AS "albumArtUrl",
      EXTRACT(EPOCH FROM started_at) * 1000 AS "startedAt",
      ST_Y(location::geometry) AS "latitude",
      ST_X(location::geometry) AS "longitude",
      EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
  `;

  const params = [
    userId,
    anonymousId,
    track.title,
    track.artist,
    track.albumArt,
    location.longitude,
    location.latitude,
    startedAt,
  ];

  const result = await pool.query(query, params);
  const row = result.rows[0];

  return {
    id: row.id,
    anonymousId: row.anonymousId,
    trackTitle: row.trackTitle,
    artistName: row.artistName,
    albumArtUrl: row.albumArtUrl,
    startedAt: Number(row.startedAt),
    location: {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracy: location.accuracy,
      timestamp: location.timestamp,
    },
    createdAt: Number(row.createdAt),
  };
}


/**
 * Remove a user's active broadcast.
 * Requirement 3.3: remove broadcast when user stops playing.
 */
export async function removeBroadcast(userId: string): Promise<void> {
  await pool.query('DELETE FROM broadcasts WHERE user_id = $1', [userId]);
}

/**
 * Get all broadcasts within a radius of a location, excluding a specific user.
 * Requirement 3.5: exclude the user's own broadcast from the feed.
 * Results sorted by distance ascending (nearest first).
 */
export async function getBroadcastsInRadius(
  location: GeoPosition,
  radiusMeters: number,
  excludeUserId: string,
): Promise<Broadcast[]> {
  const clampedRadius = Math.min(500, Math.max(50, radiusMeters));

  const query = `
    SELECT
      id,
      anonymous_id AS "anonymousId",
      track_title AS "trackTitle",
      artist_name AS "artistName",
      album_art_url AS "albumArtUrl",
      EXTRACT(EPOCH FROM started_at) * 1000 AS "startedAt",
      ST_Y(location::geometry) AS "latitude",
      ST_X(location::geometry) AS "longitude",
      EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
      ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance
    FROM broadcasts
    WHERE ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    AND user_id != $4
    ORDER BY distance ASC
  `;

  const params = [location.longitude, location.latitude, clampedRadius, excludeUserId];
  const result = await pool.query(query, params);

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    anonymousId: row.anonymousId as string,
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
  }));
}

/**
 * Expire stale broadcasts — remove broadcasts that haven't been updated
 * in over 30 seconds. Returns the number of removed broadcasts.
 * Requirement 3.3: remove broadcast within 30 seconds of stopping.
 */
export async function expireStaleBroadcasts(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM broadcasts WHERE created_at < NOW() - INTERVAL '30 seconds' RETURNING id`,
  );
  return result.rowCount ?? 0;
}
