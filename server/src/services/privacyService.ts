/**
 * PrivacyService — account deletion.
 * Requirement 8.4
 */

import pool from '../db/connection';

/**
 * Delete a user account and all associated data.
 * Requirement 8.4: remove all broadcasts, DMs, connections, and tokens.
 *
 * The DB schema uses ON DELETE CASCADE for sessions, broadcasts, reactions, comments,
 * connection_requests, connections, and user_settings. However, direct_messages
 * reference anonymous IDs (not user IDs), so we must resolve and delete those
 * explicitly before deleting the user row.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Collect every anonymous ID this user has held, across all sessions
    const anonResult = await client.query(
      'SELECT anonymous_id FROM listening_sessions WHERE user_id = $1',
      [userId],
    );
    const anonIds: string[] = anonResult.rows.map((r: { anonymous_id: string }) => r.anonymous_id);

    // Delete DMs sent or received by any of the user's anonymous IDs
    if (anonIds.length > 0) {
      await client.query(
        `DELETE FROM direct_messages
         WHERE sender_anon_id = ANY($1) OR recipient_anon_id = ANY($1)`,
        [anonIds],
      );
    }

    // Delete the user row — cascades to listening_sessions, broadcasts,
    // reactions, comments, connection_requests, connections, user_settings
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
