import pool from '../db/connection';
import type { Broadcast, GeoPosition } from '../types';

const MIN_RADIUS = 50;
const MAX_RADIUS = 500;

/**
 * ProximityService — spatial queries and radius validation.
 * Requirements: 2.2, 2.3
 */

/**
 * Clamp a radius value to [50, 500] meters.
 * Any value below 50 returns 50, above 500 returns 500.
 */
export function validateRadius(radiusMeters: number): number {
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radiusMeters));
}

/**
 * Find broadcasts within a given radius of a center point
 * using PostGIS ST_DWithin. Excludes a specific user's broadcast.
 */
export async function findNearby(
  center: GeoPosition,
  radiusMeters: number,
  excludeUserId?: string,
): Promise<Broadcast[]> {
  const clampedRadius = validateRadius(radiusMeters);

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
    ${excludeUserId ? 'AND user_id != $4' : ''}
    ORDER BY distance ASC
  `;

  const params: (string | number)[] = [center.longitude, center.latitude, clampedRadius];
  if (excludeUserId) params.push(excludeUserId);

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
