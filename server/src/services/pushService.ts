import pool from '../db/connection';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendPushToNearbyUsers(
  broadcasterId: string,
  latitude: number,
  longitude: number,
  radiusMeters: number,
  trackTitle: string,
  artistName: string,
): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT push_token FROM users
       WHERE push_token IS NOT NULL
         AND id != $1
         AND last_latitude IS NOT NULL
         AND last_longitude IS NOT NULL
         AND ST_DWithin(
           ST_SetSRID(ST_MakePoint(last_longitude, last_latitude), 4326)::geography,
           ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           $4
         )`,
      [broadcasterId, longitude, latitude, radiusMeters],
    );

    const tokens: string[] = result.rows.map((r: any) => r.push_token).filter(Boolean);
    if (tokens.length === 0) return;

    const messages: PushMessage[] = tokens.map((token) => ({
      to: token,
      title: '🎵 Someone nearby is listening',
      body: `${trackTitle} — ${artistName}`,
      data: { type: 'nearby_broadcast' },
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
  } catch (err) {
    console.error('Push notification error:', err);
  }
}
