/**
 * Social interactions API routes — reactions, comments, DMs.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 *
 * The actor's anonymous id always comes from their listening session, derived
 * from `req.userId`. Any viewerAnonId / authorAnonId / senderAnonId in the body
 * is ignored, so a client can neither choose nor spoof its own identity.
 */

import { Router, Request, Response } from 'express';
import { addReaction, getReactionCounts, addComment, getComments, sendDM, getDMThread } from '../services/socialService';
import { getOrCreateOpenSession, resolveAnonId } from '../services/sessionService';
import type { ReactionType } from '../types';

const router = Router();

const VALID_REACTIONS: ReactionType[] = ['fire', 'heart', 'headphones', 'clap', 'surprised'];

const PLAY_GONE = 'That play is no longer in the feed';

/**
 * A reaction or comment on a play that has expired (or never existed) fails
 * the broadcast_id foreign key (23503) or the UUID cast (22P02).
 */
function isMissingPlay(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === '23503' || code === '22P02';
}

/** POST /social/reactions — add a reaction to a play */
router.post('/reactions', async (req: Request, res: Response) => {
  const { broadcastId, type } = req.body;

  if (!broadcastId || !type) {
    res.status(400).json({ error: 'broadcastId and type are required' });
    return;
  }

  if (!VALID_REACTIONS.includes(type)) {
    res.status(400).json({ error: `Invalid reaction type. Must be one of: ${VALID_REACTIONS.join(', ')}` });
    return;
  }

  try {
    const { anonymousId } = await getOrCreateOpenSession(req.userId!);
    const counts = await addReaction(broadcastId, anonymousId, type);
    res.json({ counts });
  } catch (err) {
    if (isMissingPlay(err)) {
      res.status(404).json({ error: PLAY_GONE });
      return;
    }
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

/** POST /social/comments — add a comment to a play */
router.post('/comments', async (req: Request, res: Response) => {
  const { broadcastId, text } = req.body;

  if (!broadcastId || !text) {
    res.status(400).json({ error: 'broadcastId and text are required' });
    return;
  }

  try {
    const { anonymousId } = await getOrCreateOpenSession(req.userId!);
    const comment = await addComment(broadcastId, anonymousId, text);
    res.json({ comment });
  } catch (err) {
    if (isMissingPlay(err)) {
      res.status(404).json({ error: PLAY_GONE });
      return;
    }
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/** GET /social/comments/:broadcastId — get comments for a play */
router.get('/comments/:broadcastId', async (req: Request, res: Response) => {
  try {
    const comments = await getComments(req.params.broadcastId);
    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/** POST /social/dms — send a DM to an anonymous listener */
router.post('/dms', async (req: Request, res: Response) => {
  const { recipientAnonId, text, includesConnectionRequest } = req.body;

  if (!recipientAnonId || !text) {
    res.status(400).json({ error: 'recipientAnonId and text are required' });
    return;
  }

  try {
    if (!(await resolveAnonId(recipientAnonId))) {
      res.status(404).json({ error: 'That listener is no longer in the feed' });
      return;
    }
    const { anonymousId } = await getOrCreateOpenSession(req.userId!);
    const dm = await sendDM(anonymousId, recipientAnonId, text, !!includesConnectionRequest);
    res.json({ dm });
  } catch (err) {
    console.error('Send DM error:', err);
    res.status(500).json({ error: 'Failed to send DM' });
  }
});

/** GET /social/dms/:otherAnonId — the caller's DM thread with another listener */
router.get('/dms/:otherAnonId', async (req: Request, res: Response) => {
  try {
    const thread = await getDMThread(req.userId!, req.params.otherAnonId);
    res.json({ messages: thread });
  } catch (err) {
    console.error('Get DM thread error:', err);
    res.status(500).json({ error: 'Failed to get DM thread' });
  }
});

export default router;
