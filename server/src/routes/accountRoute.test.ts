/**
 * Feature: listening-sessions-and-recent-feed
 * HTTP-layer tests for the account router — presence and account deletion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockQuery = vi.fn();

vi.mock('../db/connection', () => ({
  default: { query: (...args: any[]) => mockQuery(...args) },
  pool: { query: (...args: any[]) => mockQuery(...args) },
}));

const mockDeleteAccount = vi.fn();
vi.mock('../services/privacyService', () => ({
  deleteAccount: (...a: any[]) => mockDeleteAccount(...a),
}));

const mockTouchPresence = vi.fn();
vi.mock('../services/sessionService', () => ({
  touchPresence: (...a: any[]) => mockTouchPresence(...a),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'user-access-token';

async function buildApp() {
  const { authMiddleware } = await import('../middleware/auth');
  const { default: accountRouter } = await import('./account');
  const app = express();
  app.use(express.json());
  app.use('/account', authMiddleware, accountRouter);
  return app;
}

const auth = (r: request.Test) => r.set('Authorization', `Bearer ${TOKEN}`);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [{ id: USER_ID }] });
  mockDeleteAccount.mockReset();
  mockDeleteAccount.mockResolvedValue(undefined);
  mockTouchPresence.mockReset();
  mockTouchPresence.mockResolvedValue({ anonymousId: 'anon-me' });
});

describe('POST /account/presence', () => {
  it('rejects an unauthenticated heartbeat', async () => {
    const app = await buildApp();

    const res = await request(app).post('/account/presence');

    expect(res.status).toBe(401);
    expect(mockTouchPresence).not.toHaveBeenCalled();
  });

  it('touches the caller\'s session and returns their anonymous id', async () => {
    const app = await buildApp();

    const res = await auth(request(app).post('/account/presence'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ anonymousId: 'anon-me' });
    expect(mockTouchPresence).toHaveBeenCalledWith(USER_ID);
  });
});

describe('DELETE /account/:userId', () => {
  it('deletes the caller\'s account for /account/me', async () => {
    const app = await buildApp();

    const res = await auth(request(app).delete('/account/me'));

    expect(res.status).toBe(200);
    expect(mockDeleteAccount).toHaveBeenCalledWith(USER_ID);
  });

  it('never deletes the account named in the URL', async () => {
    const app = await buildApp();

    await auth(request(app).delete(`/account/${OTHER_ID}`));

    expect(mockDeleteAccount).toHaveBeenCalledWith(USER_ID);
    expect(mockDeleteAccount).not.toHaveBeenCalledWith(OTHER_ID);
  });
});
