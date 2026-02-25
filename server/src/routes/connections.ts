/**
 * Connections API routes — list, detail, remove, and request management.
 * Requirements: 6.1–6.5, 7.1, 7.2, 7.3
 */

import { Router, Request, Response } from 'express';
import {
  getConnections,
  getConnectionDetail,
  removeConnection,
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
} from '../services/connectionService';

const router = Router();

/** GET /connections — list connections with profile name and image */
router.get('/', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  try {
    const connections = await getConnections(userId);
    res.json({ connections });
  } catch (err) {
    console.error('Get connections error:', err);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

/** GET /connections/:id — full profile detail */
router.get('/:id', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  try {
    const detail = await getConnectionDetail(req.params.id, userId);
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
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  try {
    const removed = await removeConnection(req.params.id, userId);
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

// --- Connection Request endpoints (used by existing mobile client) ---

/** POST /connections/requests — send a connection request */
router.post('/requests', async (req: Request, res: Response) => {
  const { viewerUserId, broadcasterAnonId } = req.body;
  if (!viewerUserId || !broadcasterAnonId) {
    res.status(400).json({ error: 'viewerUserId and broadcasterAnonId are required' });
    return;
  }

  try {
    const request = await sendRequest(viewerUserId, broadcasterAnonId);
    res.json({ request });
  } catch (err) {
    console.error('Send connection request error:', err);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

/** POST /connections/requests/:id/accept */
router.post('/requests/:id/accept', async (req: Request, res: Response) => {
  try {
    const connection = await acceptRequest(req.params.id);
    res.json({ connection });
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ error: 'Failed to accept connection request' });
  }
});

/** POST /connections/requests/:id/decline */
router.post('/requests/:id/decline', async (req: Request, res: Response) => {
  try {
    await declineRequest(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Decline request error:', err);
    res.status(500).json({ error: 'Failed to decline connection request' });
  }
});

/** POST /connections/requests/:id/cancel */
router.post('/requests/:id/cancel', async (req: Request, res: Response) => {
  try {
    await cancelRequest(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Cancel request error:', err);
    res.status(500).json({ error: 'Failed to cancel connection request' });
  }
});

/** GET /connections/requests/incoming/:userId */
router.get('/requests/incoming/:userId', async (req: Request, res: Response) => {
  try {
    const pool = (await import('../db/connection')).default;
    const result = await pool.query(
      `SELECT id, viewer_user_id AS "viewerUserId", broadcaster_user_id AS "broadcasterUserId",
              status, EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
              EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"
       FROM connection_requests
       WHERE broadcaster_user_id = $1
       ORDER BY created_at DESC`,
      [req.params.userId],
    );
    res.json({ requests: result.rows.map(formatRequest) });
  } catch (err) {
    console.error('Get incoming requests error:', err);
    res.status(500).json({ error: 'Failed to get incoming requests' });
  }
});

/** GET /connections/requests/outgoing/:userId */
router.get('/requests/outgoing/:userId', async (req: Request, res: Response) => {
  try {
    const pool = (await import('../db/connection')).default;
    const result = await pool.query(
      `SELECT id, viewer_user_id AS "viewerUserId", broadcaster_user_id AS "broadcasterUserId",
              status, EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
              EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"
       FROM connection_requests
       WHERE viewer_user_id = $1
       ORDER BY created_at DESC`,
      [req.params.userId],
    );
    res.json({ requests: result.rows.map(formatRequest) });
  } catch (err) {
    console.error('Get outgoing requests error:', err);
    res.status(500).json({ error: 'Failed to get outgoing requests' });
  }
});

function formatRequest(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    viewerUserId: row.viewerUserId as string,
    broadcasterUserId: row.broadcasterUserId as string,
    status: row.status as string,
    createdAt: Number(row.createdAt),
    expiresAt: Number(row.expiresAt),
  };
}

export default router;
