import { SPOTIFY_CONFIG } from '../config/spotify';
import { SpotifyAuthModule } from './spotifyAuth';

export interface CurrentTrack {
  trackId: string;
  title: string;
  artist: string;
  albumArt: string;
  startedAt: number;
}

export type TrackChangeCallback = (track: CurrentTrack | null) => void;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastTrackId: string | null = null;
let onTrackChange: TrackChangeCallback | null = null;

/**
 * Fetch the currently playing track from Spotify.
 * Returns null when nothing is playing.
 */
export async function getCurrentTrack(): Promise<CurrentTrack | null> {
  const token = await SpotifyAuthModule.getValidToken();
  if (!token) return null;

  const res = await fetch(`${SPOTIFY_CONFIG.apiBaseUrl}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.is_playing || !data.item) return null;

  return {
    trackId: data.item.id,
    title: data.item.name,
    artist: data.item.artists?.map((a: { name: string }) => a.name).join(', ') ?? 'Unknown',
    albumArt: data.item.album?.images?.[0]?.url ?? '',
    startedAt: data.timestamp ?? Date.now(),
  };
}

/** Start polling every 10s. Calls `callback` whenever the track changes or stops. */
export function startPolling(callback: TrackChangeCallback): void {
  stopPolling();
  onTrackChange = callback;
  lastTrackId = null;

  const poll = async () => {
    const track = await getCurrentTrack();
    const newId = track?.trackId ?? null;

    if (newId !== lastTrackId) {
      lastTrackId = newId;
      onTrackChange?.(track);
    }
  };

  poll(); // immediate first poll
  pollTimer = setInterval(poll, SPOTIFY_CONFIG.pollIntervalMs);
}

/** Stop polling. */
export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  onTrackChange = null;
  lastTrackId = null;
}
