/**
 * Connections API routes — list, detail, remove, and request management.
 * Requirements: 6.1–6.5, 7.1, 7.2, 7.3
 *
 * The acting user always comes from `req.userId`, set by authMiddleware. No
 * handler reads an actor identity from the body, query string, or path.
 */

import { Router, Request, Response } from 'express';
import {
  getConnections,
  getConnectionDetail,
  removeConnection,
  resolveAnonId,
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  getIncomingRequests,
  getOutgoingRequests,
  NotEntitledError,
  RequestNotFoundError,
  RequestStateError,
} from '../services/connectionService';

const router = Router();

/** Map the service's typed errors onto status codes; anything else is a 500. */
function sendRequestError(res: Response, err: unknown, logLabel: string): void {
  if (err instanceof NotEntitledError) {
    res.status(403).json({ error: err.message });
    return;
  }
  if (err instanceof RequestNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof RequestStateError) {
    res.status(409).json({ error: err.message });
    return;
  }
  console.error(`${logLabel}:`, err);
  res.status(500).json({ error: logLabel });
}

// --- Connection Request endpoints ---
// Declared before GET /:id, which would otherwise match /requests.

/** POST /connections/requests — send a connection request to a live broadcast */
router.post('/requests', async (req: Request, res: Response) => {
  const { broadcasterAnonId } = req.body;
  if (!broadcasterAnonId) {
    res.status(400).json({ error: 'broadcasterAnonId is required' });
    return;
  }

  try {
    const broadcasterUserId = await resolveAnonId(broadcasterAnonId);
    if (!broadcasterUserId) {
      res.status(404).json({ error: 'That broadcast is no longer active' });
      return;
    }

    const request = await sendRequest(req.userId!, broadcasterUserId);
    res.json({ request });
  } catch (err) {
    sendRequestError(res, err, 'Failed to send connection request');
  }
});

/** GET /connections/requests/incoming — requests addressed to the caller */
router.get('/requests/incoming', async (req: Request, res: Response) => {
  try {
    res.json({ requests: await getIncomingRequests(req.userId!) });
  } catch (err) {
    console.error('Get incoming requests error:', err);
    res.status(500).json({ error: 'Failed to get incoming requests' });
  }
});

/** GET /connections/requests/outgoing — requests the caller has sent */
router.get('/requests/outgoing', async (req: Request, res: Response) => {
  try {
    res.json({ requests: await getOutgoingRequests(req.userId!) });
  } catch (err) {
    console.error('Get outgoing requests error:', err);
    res.status(500).json({ error: 'Failed to get outgoing requests' });
  }
});

/** POST /connections/requests/:id/accept — broadcaster only */
router.post('/requests/:id/accept', async (req: Request, res: Response) => {
  try {
    const connection = await acceptRequest(req.params.id, req.userId!);
    res.json({ connection });
  } catch (err) {
    sendRequestError(res, err, 'Failed to accept connection request');
  }
});

/** POST /connections/requests/:id/decline — broadcaster only */
router.post('/requests/:id/decline', async (req: Request, res: Response) => {
  try {
    await declineRequest(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (err) {
    sendRequestError(res, err, 'Failed to decline connection request');
  }
});

/** POST /connections/requests/:id/cancel — sender only */
router.post('/requests/:id/cancel', async (req: Request, res: Response) => {
  try {
    await cancelRequest(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (err) {
    sendRequestError(res, err, 'Failed to cancel connection request');
  }
});

// --- Connection endpoints ---

/** GET /connections — list connections with profile name and image */
router.get('/', async (req: Request, res: Response) => {
  try {
    const connections = await getConnections(req.userId!);
    res.json({ connections });
  } catch (err) {
    console.error('Get connections error:', err);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

/**
 * GET /connections/:id — full profile detail.
 * A connection the caller is not part of returns 404, not 403, so a
 * non-participant cannot probe which connection ids exist.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const detail = await getConnectionDetail(req.params.id, req.userId!);
    if (!detail) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    res.json({ connection: detail });
  } catch (err) {
    console.error('Get connection detail error:', err);
    res.status(500).json({ error: 'Failed to fetch connection detail' });
  }
});

/** DELETE /connections/:id — remove connection, re-anonymize */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const removed = await removeConnection(req.params.id, req.userId!);
    if (!removed) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Remove connection error:', err);
    res.status(500).json({ error: 'Failed to remove connection' });
  }
});

export default router;
