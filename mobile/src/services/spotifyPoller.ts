import { SpotifyAuthModule } from './spotifyAuth';
import { GPSModule } from './gps';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const POLL_INTERVAL = 10_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastTrackId: string | null = null;

async function fetchCurrentlyPlaying(): Promise<any | null> {
  const token = await SpotifyAuthModule.getValidToken();
  if (!token) return null;

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204 || !res.ok) return null;
  return res.json();
}

async function postBroadcast(track: any, location: any): Promise<void> {
  const token = await SpotifyAuthModule.getValidToken();
  if (!token) return;

  await fetch(`${API_BASE}/broadcasts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ track, location }),
  });
}

async function removeBroadcast(): Promise<void> {
  const token = await SpotifyAuthModule.getValidToken();
  if (!token) return;

  await fetch(`${API_BASE}/broadcasts`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function poll(): Promise<void> {
  try {
    const data = await fetchCurrentlyPlaying();

    if (!data || !data.is_playing || !data.item) {
      if (lastTrackId) {
        await removeBroadcast();
        lastTrackId = null;
      }
      return;
    }

    const pos = await GPSModule.getCurrentPosition();
    const track = {
      title: data.item.name,
      artist: data.item.artists.map((a: any) => a.name).join(', '),
      albumArt: data.item.album?.images?.[0]?.url || '',
      startedAt: Date.now() - (data.progress_ms || 0),
    };
    const location = {
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy: pos.accuracy,
      timestamp: pos.timestamp,
    };

    await postBroadcast(track, location);
    lastTrackId = data.item.id;
  } catch (err) {
    console.error('Spotify poll error:', err);
  }
}

export function startPolling(): void {
  if (pollTimer) return;
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL);
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  lastTrackId = null;
}
