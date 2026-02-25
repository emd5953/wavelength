/**
 * Account routes — account deletion and location updates.
 * Requirement 8.4
 */

import { Router, Request, Response } from 'express';
import { deleteAccount } from '../services/privacyService';
import pool from '../db/connection';

const router = Router();

/**
 * POST /account/location
 * Update the user's last known location.
 */
router.post('/location', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { latitude, longitude } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(400).json({ error: 'latitude and longitude are required' });
    return;
  }

  try {
    await pool.query(
      'UPDATE users SET last_latitude = $1, last_longitude = $2, last_location_at = NOW() WHERE id = $3',
      [latitude, longitude, userId],
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Location update failed:', err);
    res.status(500).json({ error: 'Location update failed' });
  }
});

/**
 * DELETE /account/:userId
 * Deletes the user account and all associated data.
 */
router.delete('/:userId', async (req: Request, res: Response) => {
  try {
    await deleteAccount(req.params.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Account deletion failed:', err);
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

export default router;
