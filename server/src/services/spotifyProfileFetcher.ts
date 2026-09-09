/**
 * Spotify Profile Fetcher — retrieves real profile data from Spotify Web API.
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import pool from '../db/connection';
import type { SpotifyProfile } from '../types';
import type {
  SpotifyTopArtistsResponse,
  SpotifyTopTracksResponse,
  SpotifyUserResponse,
} from '../types/spotify';

const SPOTIFY_API = 'https://api.spotify.com/v1';

/**
 * Fetch a user's Spotify profile, top artists, and top tracks.
 * Falls back to a placeholder profile on any error.
 */
export async function fetchSpotifyProfile(userId: string): Promise<SpotifyProfile> {
  let spotifyUserId = 'Unknown User';

  try {
    const userResult = await pool.query(
      'SELECT spotify_user_id, encrypted_access_token FROM users WHERE id = $1',
      [userId],
    );

    if (userResult.rowCount === 0) {
      return fallbackProfile(spotifyUserId);
    }

    const { spotify_user_id, encrypted_access_token: token } = userResult.rows[0];
    spotifyUserId = spotify_user_id;

    if (!token) {
      return fallbackProfile(spotifyUserId);
    }

    const headers = { Authorization: `Bearer ${token}` };

    const [meRes, artistsRes, tracksRes] = await Promise.all([
      fetch(`${SPOTIFY_API}/me`, { headers }),
      fetch(`${SPOTIFY_API}/me/top/artists?limit=10`, { headers }),
      fetch(`${SPOTIFY_API}/me/top/tracks?limit=10`, { headers }),
    ]);

    if (!meRes.ok) {
      return fallbackProfile(spotifyUserId);
    }

    const me = (await meRes.json()) as SpotifyUserResponse;
    const displayName = me.display_name || spotifyUserId;
    const profileImageUrl = me.images?.[0]?.url || '';
    const profileLink = me.external_urls?.spotify || '';

    let topArtists: string[] = [];
    if (artistsRes.ok) {
      const artistsData = (await artistsRes.json()) as SpotifyTopArtistsResponse;
      topArtists = (artistsData.items || []).slice(0, 10).map((a: any) => a.name);
    }

    let topTracks: string[] = [];
    if (tracksRes.ok) {
      const tracksData = (await tracksRes.json()) as SpotifyTopTracksResponse;
      topTracks = (tracksData.items || []).slice(0, 10).map((t: any) => t.name);
    }

    return { displayName, profileImageUrl, profileLink, topArtists, topTracks };
  } catch {
    return fallbackProfile(spotifyUserId);
  }
}

function fallbackProfile(spotifyUserId: string): SpotifyProfile {
  return {
    displayName: spotifyUserId,
    profileImageUrl: '',
    profileLink: '',
    topArtists: [],
    topTracks: [],
  };
}
