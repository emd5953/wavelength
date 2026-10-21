import pool from '../db/connection';
import type {
  SpotifyTopArtistsResponse,
  SpotifyTopTracksResponse,
} from '../types/spotify';

/**
 * Sync a user's top artists and tracks from Spotify into the DB.
 */
export async function syncUserTaste(
  userId: string,
  accessToken: string,
): Promise<void> {
  try {
    const [artistsRes, tracksRes] = await Promise.all([
      fetch('https://api.spotify.com/v1/me/top/artists?limit=20&time_range=medium_term', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch('https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=medium_term', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    if (artistsRes.ok) {
      const data = (await artistsRes.json()) as SpotifyTopArtistsResponse;
      // Clear old data and insert fresh
      await pool.query('DELETE FROM user_top_artists WHERE user_id = $1', [userId]);
      for (let i = 0; i < data.items.length; i++) {
        await pool.query(
          'INSERT INTO user_top_artists (user_id, artist_name, rank, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id, artist_name) DO UPDATE SET rank = $3, updated_at = NOW()',
          [userId, data.items[i].name, i + 1],
        );
      }
    }

    if (tracksRes.ok) {
      const data = (await tracksRes.json()) as SpotifyTopTracksResponse;
      await pool.query('DELETE FROM user_top_tracks WHERE user_id = $1', [userId]);
      for (let i = 0; i < data.items.length; i++) {
        const track = data.items[i];
        const artist = track.artists.map((a: any) => a.name).join(', ');
        await pool.query(
          'INSERT INTO user_top_tracks (user_id, track_name, artist_name, rank, updated_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (user_id, track_name, artist_name) DO UPDATE SET rank = $4, updated_at = NOW()',
          [userId, track.name, artist, i + 1],
        );
      }
    }
  } catch (err) {
    console.error(`Taste sync error for user ${userId}:`, err);
  }
}

/**
 * Compute a taste match score (0-100) between two users based on shared top artists and tracks.
 */
export async function getTasteScore(userA: string, userB: string): Promise<number> {
  try {
    const [artistMatch, trackMatch] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as cnt FROM user_top_artists a
         JOIN user_top_artists b ON LOWER(a.artist_name) = LOWER(b.artist_name)
         WHERE a.user_id = $1 AND b.user_id = $2`,
        [userA, userB],
      ),
      pool.query(
        `SELECT COUNT(*) as cnt FROM user_top_tracks a
         JOIN user_top_tracks b ON LOWER(a.track_name) = LOWER(b.track_name) AND LOWER(a.artist_name) = LOWER(b.artist_name)
         WHERE a.user_id = $1 AND b.user_id = $2`,
        [userA, userB],
      ),
    ]);

    const sharedArtists = parseInt(artistMatch.rows[0].cnt, 10);
    const sharedTracks = parseInt(trackMatch.rows[0].cnt, 10);

    // Score: shared artists worth 3 pts each (max 60), shared tracks worth 2 pts each (max 40)
    const artistScore = Math.min(sharedArtists * 3, 60);
    const trackScore = Math.min(sharedTracks * 2, 40);

    return Math.min(artistScore + trackScore, 100);
  } catch (err) {
    console.error(`Taste score error for ${userA} vs ${userB}:`, err);
    return 0;
  }
}

/** Repeat tracks older than this are re-synced by the poller. */
export const REPEAT_SYNC_MAX_AGE_HOURS = 24;

/**
 * Sync a user's "on repeat" tracks: Spotify's short_term top tracks (roughly
 * the last 4 weeks). Spotify's own On Repeat playlist isn't readable through
 * the API, so this is the closest signal. On any failure the previous rows are
 * kept.
 */
export async function syncRepeatTracks(userId: string, accessToken: string): Promise<void> {
  try {
    const res = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=short_term', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;

    const data = (await res.json()) as SpotifyTopTracksResponse;
    const trackIds = data.items.map((t) => t.id);
    const ranks = trackIds.map((_, i) => i + 1);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_repeat_tracks WHERE user_id = $1', [userId]);
      await client.query(
        `INSERT INTO user_repeat_tracks (user_id, track_id, rank)
         SELECT $1, t.track_id, t.rank
         FROM unnest($2::text[], $3::int[]) AS t(track_id, rank)
         ON CONFLICT (user_id, track_id) DO NOTHING`,
        [userId, trackIds, ranks],
      );
      await client.query('UPDATE users SET repeat_tracks_synced_at = NOW() WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Repeat track sync error for user ${userId}:`, err);
  }
}

/** Whether a user's repeat tracks were never synced or are older than REPEAT_SYNC_MAX_AGE_HOURS. */
export function repeatTracksStale(syncedAt: Date | null): boolean {
  return !syncedAt || Date.now() - syncedAt.getTime() > REPEAT_SYNC_MAX_AGE_HOURS * 60 * 60 * 1000;
}
