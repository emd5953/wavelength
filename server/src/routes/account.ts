/**
 * Account routes — account deletion and location updates.
 * Requirement 8.4
 */

import { Router, Request, Response } from 'express';
import { deleteAccount } from '../services/privacyService';
import { touchPresence } from '../services/sessionService';
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
 * POST /account/presence
 * Heartbeat while the app is open. Keeps (or opens) the caller's listening
 * session and returns the anonymous id other users see them as.
 */
router.post('/presence', async (req: Request, res: Response) => {
  try {
    res.json(await touchPresence(req.userId!));
  } catch (err) {
    console.error('Presence update failed:', err);
    res.status(500).json({ error: 'Presence update failed' });
  }
});

/**
 * POST /account/push-token
 * Register an Expo push token for notifications.
 */
router.post('/push-token', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    await pool.query('UPDATE users SET push_token = $1 WHERE id = $2', [token, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Push token save failed:', err);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

/**
 * DELETE /account/me
 * Deletes the caller's account and all associated data. The path segment is
 * ignored: the account is always the authenticated caller's, never one named
 * in the URL.
 */
router.delete('/:userId', async (req: Request, res: Response) => {
  try {
    await deleteAccount(req.userId!);
    res.json({ success: true });
  } catch (err) {
    console.error('Account deletion failed:', err);
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

export default router;
