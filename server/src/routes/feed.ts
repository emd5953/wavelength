/**
 * Nearby Feed API route.
 * GET /feed/nearby — returns broadcasts sorted by proximity.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Router, Request, Response } from 'express';
import { getBroadcastsInRadius } from '../services/broadcastService';
import { validateRadius } from '../services/proximityService';

const router = Router();

router.get('/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const rawRadius = parseFloat(req.query.radius as string);
  const userId = req.query.userId as string;

  if (isNaN(lat) || isNaN(lng) || !userId) {
    res.status(400).json({ error: 'lat, lng, and userId are required' });
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
    const feed = broadcasts.map((b) => ({
      ...b,
      timeSinceStart: now - b.startedAt,
    }));

    res.json({ broadcasts: feed, count: feed.length });
  } catch (err) {
    console.error('Feed query error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby feed' });
  }
});

export default router;
