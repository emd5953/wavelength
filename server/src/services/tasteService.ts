import pool from '../db/connection';

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
      const data = await artistsRes.json();
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
      const data = await tracksRes.json();
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
    console.error('Taste sync error:', err);
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
    console.error('Taste score error:', err);
    return 0;
  }
}
