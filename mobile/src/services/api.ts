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
  const res = await fetch(`${API_BASE}/social/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ broadcastId, viewerAnonId, type }),
  });
  if (!res.ok) throw new Error(`Add reaction failed: ${res.status}`);
  return res.json();
}

export async function getReactionCounts(broadcastId: string): Promise<{ counts: ReactionCount }> {
  const res = await fetch(`${API_BASE}/social/reactions/${broadcastId}`);
  if (!res.ok) throw new Error(`Get reactions failed: ${res.status}`);
  return res.json();
}

export async function addComment(
  broadcastId: string,
  authorAnonId: string,
  text: string,
): Promise<{ comment: Comment }> {
  const res = await fetch(`${API_BASE}/social/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ broadcastId, authorAnonId, text }),
  });
  if (!res.ok) throw new Error(`Add comment failed: ${res.status}`);
  return res.json();
}

export async function getComments(broadcastId: string): Promise<{ comments: Comment[] }> {
  const res = await fetch(`${API_BASE}/social/comments/${broadcastId}`);
  if (!res.ok) throw new Error(`Get comments failed: ${res.status}`);
  return res.json();
}

export async function sendDM(
  senderAnonId: string,
  recipientAnonId: string,
  text: string,
  includesConnectionRequest: boolean = false,
): Promise<{ dm: DMMessage }> {
  const res = await fetch(`${API_BASE}/social/dms`, {
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
  const res = await fetch(`${API_BASE}/social/dms/${participantA}/${participantB}`);
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
  viewerUserId: string,
  broadcasterAnonId: string,
): Promise<{ request: ConnectionRequestData }> {
  const res = await fetch(`${API_BASE}/connections/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewerUserId, broadcasterAnonId }),
  });
  if (!res.ok) throw new Error(`Send connection request failed: ${res.status}`);
  return res.json();
}

export async function acceptConnectionRequest(
  requestId: string,
): Promise<{ connection: ConnectionData }> {
  const res = await fetch(`${API_BASE}/connections/requests/${requestId}/accept`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Accept connection request failed: ${res.status}`);
  return res.json();
}

export async function declineConnectionRequest(
  requestId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/connections/requests/${requestId}/decline`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Decline connection request failed: ${res.status}`);
}

export async function cancelConnectionRequest(
  requestId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/connections/requests/${requestId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Cancel connection request failed: ${res.status}`);
}

export async function getIncomingRequests(
  userId: string,
): Promise<{ requests: ConnectionRequestData[] }> {
  const res = await fetch(`${API_BASE}/connections/requests/incoming/${userId}`);
  if (!res.ok) throw new Error(`Get incoming requests failed: ${res.status}`);
  return res.json();
}

export async function getOutgoingRequests(
  userId: string,
): Promise<{ requests: ConnectionRequestData[] }> {
  const res = await fetch(`${API_BASE}/connections/requests/outgoing/${userId}`);
  if (!res.ok) throw new Error(`Get outgoing requests failed: ${res.status}`);
  return res.json();
}

// --- Connections List / Detail / Remove API (Requirement 7.1, 7.2, 7.3) ---

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

export async function getConnections(
  userId: string,
): Promise<{ connections: ConnectionListItem[] }> {
  const res = await fetch(`${API_BASE}/connections?userId=${userId}`);
  if (!res.ok) throw new Error(`Get connections failed: ${res.status}`);
  return res.json();
}

export async function getConnectionDetail(
  connectionId: string,
  userId: string,
): Promise<{ connection: ConnectionDetailData }> {
  const res = await fetch(`${API_BASE}/connections/${connectionId}?userId=${userId}`);
  if (!res.ok) throw new Error(`Get connection detail failed: ${res.status}`);
  return res.json();
}

export async function removeConnection(
  connectionId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/connections/${connectionId}?userId=${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Remove connection failed: ${res.status}`);
  return res.json();
}
