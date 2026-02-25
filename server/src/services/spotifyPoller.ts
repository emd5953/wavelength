/**
 * Server-side Spotify poller.
 * Polls Spotify for all registered users to check currently playing tracks.
 * Creates/removes broadcasts automatically using last known location.
 */

import pool from '../db/connection';
import { createBroadcast, removeBroadcast } from './broadcastService';

const SPOTIFY_CURRENTLY_PLAYING = 'https://api.spotify.com/v1/me/player/currently-playing';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const POLL_INTERVAL = 15_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function refreshTokenIfNeeded(user: any): Promise<string | null> {
  if (new Date(user.token_expires_at) > new Date()) {
    return user.encrypted_access_token;
  }

  try {
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.encrypted_refresh_token,
        client_id: process.env.SPOTIFY_CLIENT_ID || '',
        client_secret: process.env.SPOTIFY_CLIENT_SECRET || '',
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await pool.query(
      'UPDATE users SET encrypted_access_token = $1, token_expires_at = $2 WHERE id = $3',
      [data.access_token, expiresAt.toISOString(), user.id],
    );

    return data.access_token;
  } catch {
    return null;
  }
}

async function pollUser(user: any): Promise<void> {
  if (!user.last_latitude || !user.last_longitude) return;

  const token = await refreshTokenIfNeeded(user);
  if (!token) return;

  try {
    const res = await fetch(SPOTIFY_CURRENTLY_PLAYING, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 204 || !res.ok) {
      await removeBroadcast(user.id);
      return;
    }

    const data = await res.json();

    if (!data.is_playing || !data.item) {
      await removeBroadcast(user.id);
      return;
    }

    const track = {
      title: data.item.name,
      artist: data.item.artists.map((a: any) => a.name).join(', '),
      albumArt: data.item.album?.images?.[0]?.url || '',
      startedAt: Date.now() - (data.progress_ms || 0),
    };

    const location = {
      latitude: user.last_latitude,
      longitude: user.last_longitude,
      accuracy: 0,
      timestamp: Date.now(),
    };

    await createBroadcast(user.id, track, location);
  } catch (err) {
    // Silently fail for individual users
  }
}

async function pollAllUsers(): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT id, encrypted_access_token, encrypted_refresh_token, token_expires_at, last_latitude, last_longitude FROM users',
    );

    await Promise.allSettled(result.rows.map(pollUser));
  } catch (err) {
    console.error('Spotify poller error:', err);
  }
}

export function startSpotifyPoller(): void {
  if (pollTimer) return;
  console.log('Spotify poller started');
  pollAllUsers();
  pollTimer = setInterval(pollAllUsers, POLL_INTERVAL);
}

export function stopSpotifyPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
