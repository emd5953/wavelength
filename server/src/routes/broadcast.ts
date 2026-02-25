/**
 * Broadcast Router — create and remove music broadcasts.
 * Requirements: 3.1, 3.2, 3.3
 */

import { Router, Request, Response } from 'express';
import { createBroadcast, removeBroadcast } from '../services/broadcastService';
import { emitBroadcastNew, emitBroadcastRemoved } from '../services/feedSocket';
import { io } from '../index';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { track, location } = req.body;

  if (!track) {
    res.status(400).json({ error: 'track is required' });
    return;
  }
  if (!location) {
    res.status(400).json({ error: 'location is required' });
    return;
  }

  try {
    const broadcast = await createBroadcast(userId, track, location);
    await emitBroadcastNew(io, broadcast);
    res.status(201).json(broadcast);
  } catch (err) {
    console.error('Broadcast creation error:', err);
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  const userId = req.userId!;

  try {
    await removeBroadcast(userId);
    io.emit('broadcast:removed', userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Broadcast removal error:', err);
    res.status(500).json({ error: 'Failed to remove broadcast' });
  }
});

export default router;
