/**
 * Nearby Feed API route.
 * GET /feed/nearby — returns broadcasts sorted by proximity.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Router, Request, Response } from 'express';
import { getBroadcastsInRadius } from '../services/broadcastService';
import { validateRadius } from '../services/proximityService';
import { getTasteScore } from '../services/tasteService';

const router = Router();

/** Add random offset of ~100-200m to coordinates for privacy */
function fuzzLocation(location: { latitude: number; longitude: number; accuracy: number; timestamp: number }) {
  const offsetMeters = 100 + Math.random() * 100;
  const angle = Math.random() * 2 * Math.PI;
  const latOffset = (offsetMeters * Math.cos(angle)) / 111_320;
  const lngOffset = (offsetMeters * Math.sin(angle)) / (111_320 * Math.cos(location.latitude * (Math.PI / 180)));
  return {
    ...location,
    latitude: location.latitude + latOffset,
    longitude: location.longitude + lngOffset,
  };
}

router.get('/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const rawRadius = parseFloat(req.query.radius as string);
  const userId = req.userId!;

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'lat and lng are required' });
    return;
  }

  const radius = isNaN(rawRadius) ? 100 : validateRadius(rawRadius);

  try {
    const broadcasts = await getBroadcastsInRadius(
      { latitude: lat, longitude: lng, accuracy: 0, timestamp: Date.now() },
      radius,
      userId,
    );

    const now = Date.now();
    const feed = await Promise.all(
      broadcasts.map(async (b) => {
        const tasteScore = await getTasteScore(userId, (b as any).userId).catch(() => 0);
        return {
          ...b,
          userId: undefined,
          timeSinceStart: now - b.startedAt,
          location: b.location ? fuzzLocation(b.location) : b.location,
          tasteScore,
        };
      }),
    );

    res.json({ broadcasts: feed, count: feed.length });
  } catch (err) {
    console.error('Feed query error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby feed' });
  }
});

export default router;
