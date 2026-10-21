/**
 * PushService — on-repeat notifications.
 *
 * When a listener starts a play, nearby users who have that track on repeat
 * get one notification. Each (recipient, listener, track) is notified at most
 * once, ever: the same person replaying the song is silent, a different person
 * playing it notifies again. Dedup is by account, so a new session doesn't
 * re-notify.
 */

import pool from '../db/connection';
import type { Broadcast } from '../types';

/** Recipients are matched against their last known location within this radius. */
export const REPEAT_PUSH_RADIUS_METERS = 500;

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Notify nearby users who have `play.trackId` on repeat. Claims each
 * (recipient, listener, track) row with ON CONFLICT DO NOTHING in the same
 * statement that selects recipients, so concurrent calls can't double-send.
 * Returns the number of notifications sent.
 */
export async function notifyRepeatListeners(
  listenerUserId: string,
  play: Broadcast,
): Promise<number> {
  try {
    const result = await pool.query(
      `WITH recipients AS (
         SELECT u.id, u.push_token
         FROM users u
         JOIN user_repeat_tracks r ON r.user_id = u.id AND r.track_id = $2
         WHERE u.push_token IS NOT NULL
           AND u.id != $1
           AND u.last_latitude IS NOT NULL
           AND u.last_longitude IS NOT NULL
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(u.last_longitude, u.last_latitude), 4326)::geography,
             ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
             $5
           )
       ),
       claimed AS (
         INSERT INTO push_notifications_sent (recipient_user_id, listener_user_id, track_id)
         SELECT id, $1, $2 FROM recipients
         ON CONFLICT DO NOTHING
         RETURNING recipient_user_id
       )
       SELECT r.push_token FROM recipients r JOIN claimed c ON c.recipient_user_id = r.id`,
      [
        listenerUserId,
        play.trackId,
        play.location.longitude,
        play.location.latitude,
        REPEAT_PUSH_RADIUS_METERS,
      ],
    );

    const tokens: string[] = result.rows.map((r: any) => r.push_token).filter(Boolean);
    if (tokens.length === 0) return 0;

    const messages: PushMessage[] = tokens.map((token) => ({
      to: token,
      title: '🔁 Someone nearby is playing your song',
      body: `${play.trackTitle} — ${play.artistName}`,
      data: { type: 'repeat_track_nearby', broadcastId: play.id },
    }));

    // Expo push API — send in batches of 100
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      }).catch((err) => console.error('Push send failed:', err));
    }
    return tokens.length;
  } catch (err) {
    console.error('Push notification error:', err);
    return 0;
  }
}
