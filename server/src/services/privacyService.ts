/**
 * PrivacyService — session-scoped location cleanup and account deletion.
 * Requirements: 8.1, 8.2, 8.4
 */

import pool from '../db/connection';

/**
 * Clean up session data when a user's session ends.
 * Deletes the user's broadcast (which contains location/GPS data).
 * Requirement 8.2: retain GPS coordinates only for active session duration.
 */
export async function cleanupSessionData(userId: string): Promise<void> {
  // Skip if not a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) return;

  await pool.query('DELETE FROM broadcasts WHERE user_id = $1', [userId]);
}

/**
 * Delete a user account and all associated data.
 * Requirement 8.4: remove all broadcasts, DMs, connections, and tokens.
 *
 * The DB schema uses ON DELETE CASCADE for broadcasts, reactions, comments,
 * connection_requests, connections, and user_settings. However, direct_messages
 * reference anonymous IDs (not user IDs), so we must resolve and delete those
 * explicitly before deleting the user row.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Collect anonymous IDs that belonged to this user's broadcasts
    const anonResult = await client.query(
      'SELECT anonymous_id FROM broadcasts WHERE user_id = $1',
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

    // Delete the user row — cascades to broadcasts, reactions, comments,
    // connection_requests, connections, user_settings
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
