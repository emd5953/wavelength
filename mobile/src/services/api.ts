/**
 * API client for the Music Vicinity backend.
 */

import { SpotifyAuthModule } from './spotifyAuth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
console.log('API_BASE:', API_BASE);

/**
 * Authenticated fetch wrapper — injects Bearer token from stored Spotify credentials.
 */
async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await SpotifyAuthModule.getValidToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...init, headers });
}

export interface FeedBroadcast {
  id: string;
  anonymousId: string;
  trackTitle: string;
  artistName: string;
  albumArtUrl: string;
  startedAt: number;
  timeSinceStart: number;
  createdAt: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  tasteScore?: number;
}

export interface FeedResponse {
  broadcasts: FeedBroadcast[];
  count: number;
}

export async function fetchNearbyFeed(
  lat: number,
  lng: number,
  radius: number,
): Promise<FeedResponse> {
  const url = `${API_BASE}/feed/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
  return res.json();
}


export interface ReactionCount {
  [key: string]: number;
}

export interface Comment {
  id: string;
  broadcastId: string;
  authorAnonId: string;
  text: string;
  createdAt: number;
}

export interface DMMessage {
  id: string;
  senderAnonId: string;
  recipientAnonId: string;
  text: string;
  createdAt: number;
  includesConnectionRequest: boolean;
}

export async function addReaction(
  broadcastId: string,
  viewerAnonId: string,
  type: string,
): Promise<{ counts: ReactionCount }> {
  const res = await authFetch(`${API_BASE}/social/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ broadcastId, viewerAnonId, type }),
  });
  if (!res.ok) throw new Error(`Add reaction failed: ${res.status}`);
  return res.json();
}

export async function getReactionCounts(broadcastId: string): Promise<{ counts: ReactionCount }> {
  const res = await authFetch(`${API_BASE}/social/reactions/${broadcastId}`);
  if (!res.ok) throw new Error(`Get reactions failed: ${res.status}`);
  return res.json();
}

export async function addComment(
  broadcastId: string,
  authorAnonId: string,
  text: string,
): Promise<{ comment: Comment }> {
  const res = await authFetch(`${API_BASE}/social/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ broadcastId, authorAnonId, text }),
  });
  if (!res.ok) throw new Error(`Add comment failed: ${res.status}`);
  return res.json();
}

export async function getComments(broadcastId: string): Promise<{ comments: Comment[] }> {
  const res = await authFetch(`${API_BASE}/social/comments/${broadcastId}`);
  if (!res.ok) throw new Error(`Get comments failed: ${res.status}`);
  return res.json();
}

export async function sendDM(
  senderAnonId: string,
  recipientAnonId: string,
  text: string,
  includesConnectionRequest: boolean = false,
): Promise<{ dm: DMMessage }> {
  const res = await authFetch(`${API_BASE}/social/dms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderAnonId, recipientAnonId, text, includesConnectionRequest }),
  });
  if (!res.ok) throw new Error(`Send DM failed: ${res.status}`);
  return res.json();
}

export async function getDMThread(
  participantA: string,
  participantB: string,
): Promise<{ messages: DMMessage[] }> {
  const res = await authFetch(`${API_BASE}/social/dms/${participantA}/${participantB}`);
  if (!res.ok) throw new Error(`Get DM thread failed: ${res.status}`);
  return res.json();
}


// --- Connection Request API ---

export interface ConnectionRequestData {
  id: string;
  viewerUserId: string;
  broadcasterUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  createdAt: number;
  expiresAt: number;
}

export interface ConnectionData {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: number;
}

export async function sendConnectionRequest(
  broadcasterAnonId: string,
): Promise<{ request: ConnectionRequestData }> {
  const res = await authFetch(`${API_BASE}/connections/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ broadcasterAnonId }),
  });
  if (!res.ok) throw new Error(`Send connection request failed: ${res.status}`);
  return res.json();
}

export async function acceptConnectionRequest(
  requestId: string,
): Promise<{ connection: ConnectionData }> {
  const res = await authFetch(`${API_BASE}/connections/requests/${requestId}/accept`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Accept connection request failed: ${res.status}`);
  return res.json();
}

export async function declineConnectionRequest(
  requestId: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/connections/requests/${requestId}/decline`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Decline connection request failed: ${res.status}`);
}

export async function cancelConnectionRequest(
  requestId: string,
): Promise<void> {
  const res = await authFetch(`${API_BASE}/connections/requests/${requestId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Cancel connection request failed: ${res.status}`);
}

export async function getIncomingRequests(): Promise<{ requests: ConnectionRequestData[] }> {
  const res = await authFetch(`${API_BASE}/connections/requests/incoming`);
  if (!res.ok) throw new Error(`Get incoming requests failed: ${res.status}`);
  return res.json();
}

export async function getOutgoingRequests(): Promise<{ requests: ConnectionRequestData[] }> {
  const res = await authFetch(`${API_BASE}/connections/requests/outgoing`);
  if (!res.ok) throw new Error(`Get outgoing requests failed: ${res.status}`);
  return res.json();
}

// --- Connections List / Detail / Remove API ---

export interface SpotifyProfileData {
  displayName: string;
  profileImageUrl: string;
  profileLink: string;
  topArtists: string[];
  topTracks: string[];
}

export interface ConnectionListItem {
  id: string;
  connectedUserId: string;
  displayName: string;
  profileImageUrl: string;
  createdAt: number;
}

export interface ConnectionDetailData {
  id: string;
  connectedUserId: string;
  profile: SpotifyProfileData;
  createdAt: number;
}

export async function getConnections(): Promise<{ connections: ConnectionListItem[] }> {
  const res = await authFetch(`${API_BASE}/connections`);
  if (!res.ok) throw new Error(`Get connections failed: ${res.status}`);
  return res.json();
}

export async function getConnectionDetail(
  connectionId: string,
): Promise<{ connection: ConnectionDetailData }> {
  const res = await authFetch(`${API_BASE}/connections/${connectionId}`);
  if (!res.ok) throw new Error(`Get connection detail failed: ${res.status}`);
  return res.json();
}

export async function removeConnection(
  connectionId: string,
): Promise<{ success: boolean }> {
  const res = await authFetch(`${API_BASE}/connections/${connectionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Remove connection failed: ${res.status}`);
  return res.json();
}
