/**
 * SocialService — reactions, comments, and DMs.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import pool from '../db/connection';
import type { Comment, DM, ReactionCount, ReactionType } from '../types';

/**
 * Add a reaction to a broadcast. Enforces unique per viewer+type via DB constraint.
 * Requirement 5.1: record reaction, display updated count.
 */
export async function addReaction(
  broadcastId: string,
  viewerAnonId: string,
  type: ReactionType,
): Promise<ReactionCount> {
  await pool.query(
    `INSERT INTO reactions (broadcast_id, viewer_anon_id, reaction_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (broadcast_id, viewer_anon_id, reaction_type) DO NOTHING`,
    [broadcastId, viewerAnonId, type],
  );

  return getReactionCounts(broadcastId);
}

/**
 * Get aggregated reaction counts for a broadcast.
 */
export async function getReactionCounts(broadcastId: string): Promise<ReactionCount> {
  const result = await pool.query(
    `SELECT reaction_type, COUNT(*)::int AS count
     FROM reactions
     WHERE broadcast_id = $1
     GROUP BY reaction_type`,
    [broadcastId],
  );

  const counts: ReactionCount = {};
  for (const row of result.rows) {
    counts[row.reaction_type] = row.count;
  }
  return counts;
}


/**
 * Add a comment to a broadcast.
 * Requirement 5.2: store comment linked to broadcast.
 */
export async function addComment(
  broadcastId: string,
  authorAnonId: string,
  text: string,
): Promise<Comment> {
  const result = await pool.query(
    `INSERT INTO comments (broadcast_id, author_anon_id, text)
     VALUES ($1, $2, $3)
     RETURNING id, broadcast_id AS "broadcastId", author_anon_id AS "authorAnonId",
               text, EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"`,
    [broadcastId, authorAnonId, text],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    broadcastId: row.broadcastId,
    authorAnonId: row.authorAnonId,
    text: row.text,
    createdAt: Number(row.createdAt),
  };
}

/**
 * Retrieve all comments for a broadcast, ordered by creation time.
 * Requirement 5.2: display comments attached to broadcast.
 */
export async function getComments(broadcastId: string): Promise<Comment[]> {
  const result = await pool.query(
    `SELECT id, broadcast_id AS "broadcastId", author_anon_id AS "authorAnonId",
            text, EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
     FROM comments
     WHERE broadcast_id = $1
     ORDER BY created_at ASC`,
    [broadcastId],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    broadcastId: row.broadcastId as string,
    authorAnonId: row.authorAnonId as string,
    text: row.text as string,
    createdAt: Number(row.createdAt),
  }));
}


/**
 * Send a DM from one anonymous user to another.
 * Requirement 5.3: deliver message without revealing identity.
 * Requirement 5.5: include connection request option.
 */
export async function sendDM(
  senderAnonId: string,
  recipientAnonId: string,
  text: string,
  includesConnectionRequest: boolean = false,
): Promise<DM> {
  const result = await pool.query(
    `INSERT INTO direct_messages (sender_anon_id, recipient_anon_id, text, includes_connection_request)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_anon_id AS "senderAnonId", recipient_anon_id AS "recipientAnonId",
               text, includes_connection_request AS "includesConnectionRequest",
               EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"`,
    [senderAnonId, recipientAnonId, text, includesConnectionRequest],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    senderAnonId: row.senderAnonId,
    recipientAnonId: row.recipientAnonId,
    text: row.text,
    createdAt: Number(row.createdAt),
    includesConnectionRequest: row.includesConnectionRequest,
  };
}

/**
 * Get DM thread between two anonymous participants, ordered chronologically.
 * Requirement 5.4: keep identities hidden unless connected.
 */
export async function getDMThread(
  participantA: string,
  participantB: string,
): Promise<DM[]> {
  const result = await pool.query(
    `SELECT id, sender_anon_id AS "senderAnonId", recipient_anon_id AS "recipientAnonId",
            text, includes_connection_request AS "includesConnectionRequest",
            EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
     FROM direct_messages
     WHERE (sender_anon_id = $1 AND recipient_anon_id = $2)
        OR (sender_anon_id = $2 AND recipient_anon_id = $1)
     ORDER BY created_at ASC`,
    [participantA, participantB],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    senderAnonId: row.senderAnonId as string,
    recipientAnonId: row.recipientAnonId as string,
    text: row.text as string,
    createdAt: Number(row.createdAt),
    includesConnectionRequest: row.includesConnectionRequest as boolean,
  }));
}
