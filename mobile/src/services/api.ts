/**
 * API client for the Music Vicinity backend.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface FeedBroadcast {
  id: string;
  anonymousId: string;
  trackTitle: string;
  artistName: string;
  albumArtUrl: string;
  startedAt: number;
  timeSinceStart: number;
  createdAt: number;
}

export interface FeedResponse {
  broadcasts: FeedBroadcast[];
  count: number;
}

export async function fetchNearbyFeed(
  lat: number,
  lng: number,
  radius: number,
  userId: string,
): Promise<FeedResponse> {
  const url = `${API_BASE}/feed/nearby?lat=${lat}&lng=${lng}&radius=${radius}&userId=${userId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
  return res.json();
}
