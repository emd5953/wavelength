/**
 * ConnectionService — connection lifecycle, profile retrieval, and removal.
 * Requirements: 6.1–6.5, 7.1, 7.2, 7.3
 */

import pool from '../db/connection';
import type { Connection, SpotifyProfile } from '../types';

export interface ConnectionListItem {
  id: string;
  connectedUserId: string;
  displayName: string;
  profileImageUrl: string;
  createdAt: number;
}

export interface ConnectionDetail {
  id: string;
  connectedUserId: string;
  profile: SpotifyProfile;
  createdAt: number;
}

export interface ConnectionRequest {
  id: string;
  viewerUserId: string;
  broadcasterUserId: string;
  status: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Raised when the acting user is not the party entitled to perform the action.
 * Routes map this to 403.
 */
export class NotEntitledError extends Error {
  constructor(message = 'Not entitled to act on this request') {
    super(message);
    this.name = 'NotEntitledError';
  }
}

/**
 * Raised when a request exists but is not in the state the action requires.
 * Routes map this to 409.
 */
export class RequestStateError extends Error {
  constructor(message = 'Request is not pending') {
    super(message);
    this.name = 'RequestStateError';
  }
}

/**
 * Raised when no request exists for the given id. Routes map this to 404.
 */
export class RequestNotFoundError extends Error {
  constructor(message = 'Request not found') {
    super(message);
    this.name = 'RequestNotFoundError';
  }
}

/**
 * Resolve a live broadcast's anonymous id to the user broadcasting it.
 *
 * Anonymous ids rotate per broadcast (broadcastService assigns a fresh one on
 * every insert), so this only resolves while the broadcast is active. A viewer
 * can therefore only address someone whose broadcast they can currently see.
 * Returns null once the broadcast has ended.
 */
export async function resolveAnonId(anonymousId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT user_id AS "userId" FROM broadcasts WHERE anonymous_id = $1',
    [anonymousId],
  );
  return result.rowCount === 0 ? null : (result.rows[0].userId as string);
}

/**
 * Load a request and assert the acting user may perform `verb` on it.
 * Accept and decline belong to the broadcaster; cancel belongs to the viewer.
 */
async function authorizeRequest(
  requestId: string,
  actingUserId: string,
  verb: 'accept' | 'decline' | 'cancel',
): Promise<{ viewerUserId: string; broadcasterUserId: string }> {
  const result = await pool.query(
    `SELECT viewer_user_id AS "viewerUserId", broadcaster_user_id AS "broadcasterUserId", status
     FROM connection_requests WHERE id = $1`,
    [requestId],
  );

  if (result.rowCount === 0) throw new RequestNotFoundError();

  const { viewerUserId, broadcasterUserId, status } = result.rows[0];
  const entitled = verb === 'cancel' ? viewerUserId : broadcasterUserId;
  if (entitled !== actingUserId) throw new NotEntitledError();
  if (status !== 'pending') throw new RequestStateError(`Request is ${status}`);

  return { viewerUserId, broadcasterUserId };
}

/**
 * Send a connection request from viewer to broadcaster.
 * Requirement 6.1: create pending request with 24h expiry.
 */
export async function sendRequest(
  viewerUserId: string,
  broadcasterUserId: string,
): Promise<{ id: string; status: string; expiresAt: number }> {
  if (viewerUserId === broadcasterUserId) {
    throw new RequestStateError('Cannot send a connection request to yourself');
  }

  const existing = await pool.query(
    `SELECT 1 FROM connection_requests
     WHERE viewer_user_id = $1 AND broadcaster_user_id = $2 AND status = 'pending'`,
    [viewerUserId, broadcasterUserId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    throw new RequestStateError('A pending request to this listener already exists');
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const result = await pool.query(
    `INSERT INTO connection_requests (viewer_user_id, broadcaster_user_id, status, expires_at)
     VALUES ($1, $2, 'pending', $3)
     RETURNING id, status, EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"`,
    [viewerUserId, broadcasterUserId, expiresAt],
  );
  const row = result.rows[0];
  return { id: row.id, status: row.status, expiresAt: Number(row.expiresAt) };
}

/**
 * Accept a connection request — reveal profiles, create Connection record.
 * Requirement 6.2
 */
export async function acceptRequest(requestId: string, actingUserId: string): Promise<Connection> {
  const { viewerUserId, broadcasterUserId } = await authorizeRequest(requestId, actingUserId, 'accept');

  await pool.query(
    `UPDATE connection_requests SET status = 'accepted' WHERE id = $1 AND status = 'pending'`,
    [requestId],
  );

  const connResult = await pool.query(
    `INSERT INTO connections (user_a_id, user_b_id)
     VALUES ($1, $2)
     ON CONFLICT (user_a_id, user_b_id) DO NOTHING
     RETURNING id, EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"`,
    [viewerUserId, broadcasterUserId],
  );

  const profileA = await fetchSpotifyProfile(viewerUserId);
  const profileB = await fetchSpotifyProfile(broadcasterUserId);

  const row = connResult.rows[0] ?? (await getConnectionRowBetween(viewerUserId, broadcasterUserId));

  return {
    id: row.id,
    userAId: viewerUserId,
    userBId: broadcasterUserId,
    spotifyProfileA: profileA,
    spotifyProfileB: profileB,
    createdAt: Number(row.createdAt),
  };
}

/**
 * Decline a connection request.
 * Requirement 6.3
 */
export async function declineRequest(requestId: string, actingUserId: string): Promise<void> {
  await authorizeRequest(requestId, actingUserId, 'decline');
  await pool.query(
    `UPDATE connection_requests SET status = 'declined' WHERE id = $1 AND status = 'pending'`,
    [requestId],
  );
}

/**
 * Cancel a pending connection request.
 * Requirement 6.4
 */
export async function cancelRequest(requestId: string, actingUserId: string): Promise<void> {
  await authorizeRequest(requestId, actingUserId, 'cancel');
  await pool.query(
    `UPDATE connection_requests SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`,
    [requestId],
  );
}

/**
 * Expire stale connection requests older than 24h.
 * Requirement 6.5
 */
export async function expireStaleRequests(): Promise<number> {
  const result = await pool.query(
    `UPDATE connection_requests SET status = 'expired'
     WHERE status = 'pending' AND expires_at < NOW()`,
  );
  return result.rowCount ?? 0;
}

/**
 * Get connections list for a user — profile name and image only.
 * Requirement 7.1
 */
export async function getConnections(userId: string): Promise<ConnectionListItem[]> {
  const result = await pool.query(
    `SELECT c.id,
            CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END AS "connectedUserId",
            EXTRACT(EPOCH FROM c.created_at) * 1000 AS "createdAt"
     FROM connections c
     WHERE c.user_a_id = $1 OR c.user_b_id = $1
     ORDER BY c.created_at DESC`,
    [userId],
  );

  const items: ConnectionListItem[] = [];
  for (const row of result.rows) {
    const profile = await fetchSpotifyProfile(row.connectedUserId);
    items.push({
      id: row.id,
      connectedUserId: row.connectedUserId,
      displayName: profile.displayName,
      profileImageUrl: profile.profileImageUrl,
      createdAt: Number(row.createdAt),
    });
  }
  return items;
}

/**
 * Get full connection detail — profile link, top artists, top tracks.
 * Requirement 7.2
 */
export async function getConnectionDetail(
  connectionId: string,
  requestingUserId: string,
): Promise<ConnectionDetail | null> {
  const result = await pool.query(
    `SELECT id,
            user_a_id AS "userAId",
            user_b_id AS "userBId",
            EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
     FROM connections
     WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [connectionId, requestingUserId],
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  const connectedUserId = row.userAId === requestingUserId ? row.userBId : row.userAId;
  const profile = await fetchSpotifyProfile(connectedUserId);

  return {
    id: row.id,
    connectedUserId,
    profile,
    createdAt: Number(row.createdAt),
  };
}

/**
 * Remove a connection — delete for both users, re-anonymize future interactions.
 * Requirement 7.3
 */
export async function removeConnection(
  connectionId: string,
  requestingUserId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM connections
     WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [connectionId, requestingUserId],
  );
  return (result.rowCount ?? 0) > 0;
}

// --- Internal helpers ---

async function getConnectionRowBetween(userAId: string, userBId: string) {
  const result = await pool.query(
    `SELECT id, EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
     FROM connections
     WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
    [userAId, userBId],
  );
  return result.rows[0];
}

/**
 * Fetch Spotify profile data for a user.
 * In a full implementation this would call the Spotify API for top artists/tracks.
 * For now, we pull what we have from the users table and return placeholder top data.
 */
async function fetchSpotifyProfile(userId: string): Promise<SpotifyProfile> {
  const result = await pool.query(
    `SELECT spotify_user_id FROM users WHERE id = $1`,
    [userId],
  );

  if (result.rowCount === 0) {
    return {
      displayName: 'Unknown User',
      profileImageUrl: '',
      profileLink: '',
      topArtists: [],
      topTracks: [],
    };
  }

  const spotifyUserId = result.rows[0].spotify_user_id;

  return {
    displayName: spotifyUserId,
    profileImageUrl: `https://via.placeholder.com/150?text=${encodeURIComponent(spotifyUserId)}`,
    profileLink: `https://open.spotify.com/user/${encodeURIComponent(spotifyUserId)}`,
    topArtists: [],
    topTracks: [],
  };
}

/**
 * Requests addressed to a user — the ones they can accept or decline.
 * Requirement 6.1
 */
export async function getIncomingRequests(userId: string): Promise<ConnectionRequest[]> {
  return queryRequests('broadcaster_user_id', userId);
}

/**
 * Requests a user has sent — the ones they can cancel.
 * Requirement 6.4
 */
export async function getOutgoingRequests(userId: string): Promise<ConnectionRequest[]> {
  return queryRequests('viewer_user_id', userId);
}

/** Shared body of the two listings; `column` is a literal, never user input. */
async function queryRequests(
  column: 'broadcaster_user_id' | 'viewer_user_id',
  userId: string,
): Promise<ConnectionRequest[]> {
  const result = await pool.query(
    `SELECT id, viewer_user_id AS "viewerUserId", broadcaster_user_id AS "broadcasterUserId",
            status, EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
            EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"
     FROM connection_requests
     WHERE ${column} = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    viewerUserId: row.viewerUserId as string,
    broadcasterUserId: row.broadcasterUserId as string,
    status: row.status as string,
    createdAt: Number(row.createdAt),
    expiresAt: Number(row.expiresAt),
  }));
}
