/**
 * Auth Middleware — validates Bearer token and attaches userId to request.
 * Requirements: 2.1, 2.2
 */

import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection';

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE encrypted_access_token = $1',
      [token],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.userId = result.rows[0].id;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export default authMiddleware;
