/**
 * Account routes — account deletion.
 * Requirement 8.4
 */

import { Router, Request, Response } from 'express';
import { deleteAccount } from '../services/privacyService';

const router = Router();

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
