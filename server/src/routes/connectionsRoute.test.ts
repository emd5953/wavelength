/**
 * Feature: full-app-integration
 * HTTP-layer tests for the connections router — the mutual opt-in reveal handshake.
 * Validates: Requirements 6.1–6.5, 7.1–7.3 at the request/response boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockQuery = vi.fn();

vi.mock('../db/connection', () => ({
  default: { query: (...args: any[]) => mockQuery(...args) },
  pool: { query: (...args: any[]) => mockQuery(...args) },
}));

const svc = {
  getConnections: vi.fn(),
  getConnectionDetail: vi.fn(),
  removeConnection: vi.fn(),
  sendRequest: vi.fn(),
  acceptRequest: vi.fn(),
  declineRequest: vi.fn(),
  cancelRequest: vi.fn(),
};

vi.mock('../services/connectionService', () => ({
  getConnections: (...a: any[]) => svc.getConnections(...a),
  getConnectionDetail: (...a: any[]) => svc.getConnectionDetail(...a),
  removeConnection: (...a: any[]) => svc.removeConnection(...a),
  sendRequest: (...a: any[]) => svc.sendRequest(...a),
  acceptRequest: (...a: any[]) => svc.acceptRequest(...a),
  declineRequest: (...a: any[]) => svc.declineRequest(...a),
  cancelRequest: (...a: any[]) => svc.cancelRequest(...a),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'user-access-token';

async function buildApp() {
  const { authMiddleware } = await import('../middleware/auth');
  const { default: connectionsRouter } = await import('./connections');
  const app = express();
  app.use(express.json());
  app.use('/connections', authMiddleware, connectionsRouter);
  return app;
}

/** Authenticated request helpers. */
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${TOKEN}`);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [{ id: USER_ID }] });
  for (const fn of Object.values(svc)) fn.mockReset();
});

// ============================================================
// Auth boundary
// ============================================================

describe('connections router — auth', () => {
  it('rejects every endpoint without a bearer token', async () => {
    const app = await buildApp();

    const responses = await Promise.all([
      request(app).get('/connections').query({ userId: USER_ID }),
      request(app).get('/connections/c1').query({ userId: USER_ID }),
      request(app).delete('/connections/c1').query({ userId: USER_ID }),
      request(app).post('/connections/requests').send({ viewerUserId: USER_ID, broadcasterAnonId: 'anon' }),
      request(app).post('/connections/requests/r1/accept'),
    ]);

    for (const res of responses) expect(res.status).toBe(401);
    expect(svc.getConnections).not.toHaveBeenCalled();
    expect(svc.acceptRequest).not.toHaveBeenCalled();
  });
});

// ============================================================
// Listing and detail
// ============================================================

describe('GET /connections', () => {
  it('returns 400 without a userId', async () => {
    const app = await buildApp();
    const res = await auth(request(app).get('/connections'));

    expect(res.status).toBe(400);
    expect(svc.getConnections).not.toHaveBeenCalled();
  });

  it('returns the caller connections', async () => {
    const app = await buildApp();
    svc.getConnections.mockResolvedValue([{ id: 'c1', displayName: 'Ada' }]);

    const res = await auth(request(app).get('/connections').query({ userId: USER_ID }));

    expect(res.status).toBe(200);
    expect(res.body.connections).toEqual([{ id: 'c1', displayName: 'Ada' }]);
    expect(svc.getConnections).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when the lookup fails', async () => {
    const app = await buildApp();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    svc.getConnections.mockRejectedValue(new Error('db down'));

    const res = await auth(request(app).get('/connections').query({ userId: USER_ID }));

    expect(res.status).toBe(500);
    logged.mockRestore();
  });
});

describe('GET /connections/:id', () => {
  it('returns 404 when the connection does not belong to the caller', async () => {
    const app = await buildApp();
    svc.getConnectionDetail.mockResolvedValue(null);

    const res = await auth(request(app).get('/connections/c1').query({ userId: USER_ID }));

    expect(res.status).toBe(404);
    expect(svc.getConnectionDetail).toHaveBeenCalledWith('c1', USER_ID);
  });

  it('reveals the profile only for an existing connection', async () => {
    const app = await buildApp();
    const detail = { id: 'c1', displayName: 'Ada', spotifyUrl: 'https://open.spotify.com/user/ada', topArtists: [] };
    svc.getConnectionDetail.mockResolvedValue(detail);

    const res = await auth(request(app).get('/connections/c1').query({ userId: USER_ID }));

    expect(res.status).toBe(200);
    expect(res.body.connection).toEqual(detail);
  });

  it('returns 400 without a userId', async () => {
    const app = await buildApp();
    const res = await auth(request(app).get('/connections/c1'));

    expect(res.status).toBe(400);
    expect(svc.getConnectionDetail).not.toHaveBeenCalled();
  });
});

describe('DELETE /connections/:id', () => {
  it('re-anonymizes an existing connection', async () => {
    const app = await buildApp();
    svc.removeConnection.mockResolvedValue(true);

    const res = await auth(request(app).delete('/connections/c1').query({ userId: USER_ID }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(svc.removeConnection).toHaveBeenCalledWith('c1', USER_ID);
  });

  it('returns 404 when there is nothing to remove', async () => {
    const app = await buildApp();
    svc.removeConnection.mockResolvedValue(false);

    const res = await auth(request(app).delete('/connections/c1').query({ userId: USER_ID }));

    expect(res.status).toBe(404);
  });
});

// ============================================================
// Request handshake
// ============================================================

describe('POST /connections/requests', () => {
  it('requires both the viewer id and the broadcaster anon id', async () => {
    const app = await buildApp();

    const missingAnon = await auth(request(app).post('/connections/requests')).send({ viewerUserId: USER_ID });
    const missingViewer = await auth(request(app).post('/connections/requests')).send({ broadcasterAnonId: 'anon-1' });

    expect(missingAnon.status).toBe(400);
    expect(missingViewer.status).toBe(400);
    expect(svc.sendRequest).not.toHaveBeenCalled();
  });

  it('addresses the request by anon id, never by broadcaster user id', async () => {
    const app = await buildApp();
    svc.sendRequest.mockResolvedValue({ id: 'r1', status: 'pending' });

    const res = await auth(request(app).post('/connections/requests')).send({
      viewerUserId: USER_ID,
      broadcasterAnonId: 'anon-1',
    });

    expect(res.status).toBe(200);
    expect(svc.sendRequest).toHaveBeenCalledWith(USER_ID, 'anon-1');
    expect(JSON.stringify(res.body)).not.toContain(OTHER_ID);
  });
});

describe('POST /connections/requests/:id/{accept,decline,cancel}', () => {
  it('accept returns the newly formed connection', async () => {
    const app = await buildApp();
    svc.acceptRequest.mockResolvedValue({ id: 'c1', userA: USER_ID, userB: OTHER_ID });

    const res = await auth(request(app).post('/connections/requests/r1/accept'));

    expect(res.status).toBe(200);
    expect(res.body.connection.id).toBe('c1');
    expect(svc.acceptRequest).toHaveBeenCalledWith('r1');
  });

  it('decline resolves without forming a connection', async () => {
    const app = await buildApp();
    svc.declineRequest.mockResolvedValue(undefined);

    const res = await auth(request(app).post('/connections/requests/r1/decline'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(svc.acceptRequest).not.toHaveBeenCalled();
  });

  it('cancel resolves without forming a connection', async () => {
    const app = await buildApp();
    svc.cancelRequest.mockResolvedValue(undefined);

    const res = await auth(request(app).post('/connections/requests/r1/cancel'));

    expect(res.status).toBe(200);
    expect(svc.cancelRequest).toHaveBeenCalledWith('r1');
  });

  it('returns 500 when accepting fails', async () => {
    const app = await buildApp();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    svc.acceptRequest.mockRejectedValue(new Error('expired'));

    const res = await auth(request(app).post('/connections/requests/r1/accept'));

    expect(res.status).toBe(500);
    logged.mockRestore();
  });
});

// ============================================================
// Request listings
// ============================================================

describe('GET /connections/requests/{incoming,outgoing}/:userId', () => {
  const row = {
    id: 'r1',
    viewerUserId: USER_ID,
    broadcasterUserId: OTHER_ID,
    status: 'pending',
    createdAt: '1700000000000',
    expiresAt: '1700000086400',
  };

  it('is not shadowed by the GET /:id route', async () => {
    const app = await buildApp();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: USER_ID }] }).mockResolvedValueOnce({ rows: [row] });

    const res = await auth(request(app).get(`/connections/requests/incoming/${USER_ID}`));

    expect(res.status).toBe(200);
    expect(svc.getConnectionDetail).not.toHaveBeenCalled();
  });

  it('coerces the epoch columns to numbers', async () => {
    const app = await buildApp();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: USER_ID }] }).mockResolvedValueOnce({ rows: [row] });

    const res = await auth(request(app).get(`/connections/requests/incoming/${USER_ID}`));

    expect(res.body.requests[0].createdAt).toBe(1700000000000);
    expect(res.body.requests[0].expiresAt).toBe(1700000086400);
  });

  it('filters incoming by broadcaster and outgoing by viewer', async () => {
    const app = await buildApp();

    mockQuery.mockResolvedValueOnce({ rows: [{ id: USER_ID }] }).mockResolvedValueOnce({ rows: [] });
    await auth(request(app).get(`/connections/requests/incoming/${USER_ID}`));
    expect(mockQuery.mock.calls[1][0]).toContain('broadcaster_user_id = $1');

    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: USER_ID }] }).mockResolvedValueOnce({ rows: [] });
    await auth(request(app).get(`/connections/requests/outgoing/${USER_ID}`));
    expect(mockQuery.mock.calls[1][0]).toContain('viewer_user_id = $1');
  });
});
