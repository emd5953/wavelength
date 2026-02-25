/**
 * Social interactions API routes — reactions, comments, DMs.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { Router, Request, Response } from 'express';
import { addReaction, getReactionCounts, addComment, getComments, sendDM, getDMThread } from '../services/socialService';
import type { ReactionType } from '../types';

const router = Router();

const VALID_REACTIONS: ReactionType[] = ['fire', 'heart', 'headphones', 'clap', 'surprised'];

/** POST /social/reactions — add a reaction to a broadcast */
router.post('/reactions', async (req: Request, res: Response) => {
  const { broadcastId, viewerAnonId, type } = req.body;

  if (!broadcastId || !viewerAnonId || !type) {
    res.status(400).json({ error: 'broadcastId, viewerAnonId, and type are required' });
    return;
  }

  if (!VALID_REACTIONS.includes(type)) {
    res.status(400).json({ error: `Invalid reaction type. Must be one of: ${VALID_REACTIONS.join(', ')}` });
    return;
  }

  try {
    const counts = await addReaction(broadcastId, viewerAnonId, type);
    res.json({ counts });
  } catch (err) {
    console.error('Add reaction error:', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

/** GET /social/reactions/:broadcastId — get reaction counts */
router.get('/reactions/:broadcastId', async (req: Request, res: Response) => {
  try {
    const counts = await getReactionCounts(req.params.broadcastId);
    res.json({ counts });
  } catch (err) {
    console.error('Get reactions error:', err);
    res.status(500).json({ error: 'Failed to get reactions' });
  }
});

/** POST /social/comments — add a comment to a broadcast */
router.post('/comments', async (req: Request, res: Response) => {
  const { broadcastId, authorAnonId, text } = req.body;

  if (!broadcastId || !authorAnonId || !text) {
    res.status(400).json({ error: 'broadcastId, authorAnonId, and text are required' });
    return;
  }

  try {
    const comment = await addComment(broadcastId, authorAnonId, text);
    res.json({ comment });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/** GET /social/comments/:broadcastId — get comments for a broadcast */
router.get('/comments/:broadcastId', async (req: Request, res: Response) => {
  try {
    const comments = await getComments(req.params.broadcastId);
    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/** POST /social/dms — send a DM to an anonymous user */
router.post('/dms', async (req: Request, res: Response) => {
  const { senderAnonId, recipientAnonId, text, includesConnectionRequest } = req.body;

  if (!senderAnonId || !recipientAnonId || !text) {
    res.status(400).json({ error: 'senderAnonId, recipientAnonId, and text are required' });
    return;
  }

  try {
    const dm = await sendDM(senderAnonId, recipientAnonId, text, !!includesConnectionRequest);
    res.json({ dm });
  } catch (err) {
    console.error('Send DM error:', err);
    res.status(500).json({ error: 'Failed to send DM' });
  }
});

/** GET /social/dms/:participantA/:participantB — get DM thread between two anonymous users */
router.get('/dms/:participantA/:participantB', async (req: Request, res: Response) => {
  try {
    const thread = await getDMThread(req.params.participantA, req.params.participantB);
    res.json({ messages: thread });
  } catch (err) {
    console.error('Get DM thread error:', err);
    res.status(500).json({ error: 'Failed to get DM thread' });
  }
});

export default router;
