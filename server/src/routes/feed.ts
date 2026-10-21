/**
 * Nearby Feed API route.
 * GET /feed/nearby — plays within the radius from the last 6h, live first,
 * then newest first. Locations are exact (fuzzing removed 2026-10-21).
 */

import { Router, Request, Response } from 'express';
import { getFeedInRadius } from '../services/broadcastService';
import { validateRadius } from '../services/proximityService';
import { getTasteScore } from '../services/tasteService';

const router = Router();

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
    const broadcasts = await getFeedInRadius(
      { latitude: lat, longitude: lng, accuracy: 0, timestamp: Date.now() },
      radius,
      userId,
    );

    const now = Date.now();
    const feed = await Promise.all(
      broadcasts.map(async (b) => {
        const { userId: listenerId, ...play } = b;
        const tasteScore = await getTasteScore(userId, listenerId!).catch(() => 0);
        return {
          ...play,
          timeSinceStart: now - b.startedAt,
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
