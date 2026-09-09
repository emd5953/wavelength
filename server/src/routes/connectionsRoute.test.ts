/**
 * Feature: full-app-integration
 * HTTP-layer tests for the connections router — the mutual opt-in reveal handshake.
 * Validates: Requirements 6.1–6.5, 7.1–7.3 at the request/response boundary.
 *
 * The acting user must always come from req.userId. These tests assert that a
 * body or query parameter cannot substitute for it.
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
  resolveAnonId: vi.fn(),
  sendRequest: vi.fn(),
  acceptRequest: vi.fn(),
  declineRequest: vi.fn(),
  cancelRequest: vi.fn(),
  getIncomingRequests: vi.fn(),
  getOutgoingRequests: vi.fn(),
};

// The error classes are real — the router narrows on `instanceof`, so mocking
// them as plain objects would silently turn every mapped status into a 500.
vi.mock('../services/connectionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/connectionService')>();
  return {
    NotEntitledError: actual.NotEntitledError,
    RequestNotFoundError: actual.RequestNotFoundError,
    RequestStateError: actual.RequestStateError,
    getConnections: (...a: any[]) => svc.getConnections(...a),
    getConnectionDetail: (...a: any[]) => svc.getConnectionDetail(...a),
    removeConnection: (...a: any[]) => svc.removeConnection(...a),
    resolveAnonId: (...a: any[]) => svc.resolveAnonId(...a),
    sendRequest: (...a: any[]) => svc.sendRequest(...a),
    acceptRequest: (...a: any[]) => svc.acceptRequest(...a),
    declineRequest: (...a: any[]) => svc.declineRequest(...a),
    cancelRequest: (...a: any[]) => svc.cancelRequest(...a),
    getIncomingRequests: (...a: any[]) => svc.getIncomingRequests(...a),
    getOutgoingRequests: (...a: any[]) => svc.getOutgoingRequests(...a),
  };
});

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

const auth = (r: request.Test) => r.set('Authorization', `Bearer ${TOKEN}`);

/** Import the real error classes for throwing from mocked service calls. */
async function errors() {
  return await import('../services/connectionService');
}

beforeEach(() => {
  mockQuery.mockReset();
  // authMiddleware resolves the bearer token to USER_ID.
  mockQuery.mockResolvedValue({ rows: [{ id: USER_ID }] });
  for (const fn of Object.values(svc)) fn.mockReset();
  svc.getConnections.mockResolvedValue([]);
  svc.getIncomingRequests.mockResolvedValue([]);
  svc.getOutgoingRequests.mockResolvedValue([]);
});

// ============================================================
// Auth boundary
// ============================================================

describe('connections router — auth', () => {
  it('rejects every endpoint without a bearer token', async () => {
    const app = await buildApp();

    const responses = await Promise.all([
      request(app).get('/connections'),
      request(app).get('/connections/c1'),
      request(app).delete('/connections/c1'),
      request(app).post('/connections/requests').send({ broadcasterAnonId: 'anon' }),
      request(app).post('/connections/requests/r1/accept'),
      request(app).get('/connections/requests/incoming'),
    ]);

    for (const res of responses) expect(res.status).toBe(401);
    expect(svc.getConnections).not.toHaveBeenCalled();
    expect(svc.acceptRequest).not.toHaveBeenCalled();
  });
});

// ============================================================
// The actor comes from req.userId, never from client input
// ============================================================

describe('connections router — actor identity', () => {
  it('lists the authenticated user connections, ignoring ?userId=', async () => {
    const app = await buildApp();

    await auth(request(app).get('/connections').query({ userId: OTHER_ID }));

    expect(svc.getConnections).toHaveBeenCalledWith(USER_ID);
  });

  it('scopes connection detail to the authenticated user, ignoring ?userId=', async () => {
    const app = await buildApp();
    svc.getConnectionDetail.mockResolvedValue({ id: 'c1' });

    await auth(request(app).get('/connections/c1').query({ userId: OTHER_ID }));

    expect(svc.getConnectionDetail).toHaveBeenCalledWith('c1', USER_ID);
  });

  it('scopes removal to the authenticated user, ignoring ?userId=', async () => {
    const app = await buildApp();
    svc.removeConnection.mockResolvedValue(true);

    await auth(request(app).delete('/connections/c1').query({ userId: OTHER_ID }));

    expect(svc.removeConnection).toHaveBeenCalledWith('c1', USER_ID);
  });

  it('sends a request as the authenticated user, ignoring a body viewerUserId', async () => {
    const app = await buildApp();
    svc.resolveAnonId.mockResolvedValue(OTHER_ID);
    svc.sendRequest.mockResolvedValue({ id: 'r1', status: 'pending' });

    await auth(request(app).post('/connections/requests')).send({
      broadcasterAnonId: 'anon-1',
      viewerUserId: OTHER_ID,
    });

    expect(svc.sendRequest).toHaveBeenCalledWith(USER_ID, OTHER_ID);
  });

  it('passes the authenticated user as the actor on accept, decline, and cancel', async () => {
    const app = await buildApp();
    svc.acceptRequest.mockResolvedValue({ id: 'c1' });

    await auth(request(app).post('/connections/requests/r1/accept'));
    await auth(request(app).post('/connections/requests/r1/decline'));
    await auth(request(app).post('/connections/requests/r1/cancel'));

    expect(svc.acceptRequest).toHaveBeenCalledWith('r1', USER_ID);
    expect(svc.declineRequest).toHaveBeenCalledWith('r1', USER_ID);
    expect(svc.cancelRequest).toHaveBeenCalledWith('r1', USER_ID);
  });
});

// ============================================================
// Sending a request
// ============================================================

describe('POST /connections/requests', () => {
  it('requires broadcasterAnonId', async () => {
    const app = await buildApp();

    const res = await auth(request(app).post('/connections/requests')).send({});

    expect(res.status).toBe(400);
    expect(svc.resolveAnonId).not.toHaveBeenCalled();
  });

  it('resolves the anon id to a user id before writing', async () => {
    const app = await buildApp();
    svc.resolveAnonId.mockResolvedValue(OTHER_ID);
    svc.sendRequest.mockResolvedValue({ id: 'r1', status: 'pending' });

    const res = await auth(request(app).post('/connections/requests')).send({
      broadcasterAnonId: 'anon-1',
    });

    expect(res.status).toBe(200);
    expect(svc.resolveAnonId).toHaveBeenCalledWith('anon-1');
    // The raw anon id must never reach sendRequest — it is not a UUID.
    expect(svc.sendRequest).toHaveBeenCalledWith(USER_ID, OTHER_ID);
  });

  it('returns 404 when the broadcast has ended', async () => {
    const app = await buildApp();
    svc.resolveAnonId.mockResolvedValue(null);

    const res = await auth(request(app).post('/connections/requests')).send({
      broadcasterAnonId: 'anon-stale',
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('no longer active');
    expect(svc.sendRequest).not.toHaveBeenCalled();
  });

  it('returns 409 on a duplicate pending request', async () => {
    const app = await buildApp();
    const { RequestStateError } = await errors();
    svc.resolveAnonId.mockResolvedValue(OTHER_ID);
    svc.sendRequest.mockRejectedValue(new RequestStateError('A pending request already exists'));

    const res = await auth(request(app).post('/connections/requests')).send({
      broadcasterAnonId: 'anon-1',
    });

    expect(res.status).toBe(409);
  });

  it('returns 500 on an unexpected failure', async () => {
    const app = await buildApp();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    svc.resolveAnonId.mockRejectedValue(new Error('db down'));

    const res = await auth(request(app).post('/connections/requests')).send({
      broadcasterAnonId: 'anon-1',
    });

    expect(res.status).toBe(500);
    logged.mockRestore();
  });
});

// ============================================================
// Acting on a request
// ============================================================

describe('POST /connections/requests/:id/{accept,decline,cancel}', () => {
  it('accept returns the newly formed connection', async () => {
    const app = await buildApp();
    svc.acceptRequest.mockResolvedValue({ id: 'c1', userAId: USER_ID, userBId: OTHER_ID });

    const res = await auth(request(app).post('/connections/requests/r1/accept'));

    expect(res.status).toBe(200);
    expect(res.body.connection.id).toBe('c1');
  });

  it('returns 403 when acting on a request that is not yours', async () => {
    const app = await buildApp();
    const { NotEntitledError } = await errors();
    svc.acceptRequest.mockRejectedValue(new NotEntitledError());

    const res = await auth(request(app).post('/connections/requests/r1/accept'));

    expect(res.status).toBe(403);
  });

  it('returns 403 when cancelling a request you received rather than sent', async () => {
    const app = await buildApp();
    const { NotEntitledError } = await errors();
    svc.cancelRequest.mockRejectedValue(new NotEntitledError());

    const res = await auth(request(app).post('/connections/requests/r1/cancel'));

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown request id', async () => {
    const app = await buildApp();
    const { RequestNotFoundError } = await errors();
    svc.declineRequest.mockRejectedValue(new RequestNotFoundError());

    const res = await auth(request(app).post('/connections/requests/r1/decline'));

    expect(res.status).toBe(404);
  });

  it('returns 409 for a request that is no longer pending', async () => {
    const app = await buildApp();
    const { RequestStateError } = await errors();
    svc.acceptRequest.mockRejectedValue(new RequestStateError('Request is expired'));

    const res = await auth(request(app).post('/connections/requests/r1/accept'));

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('expired');
  });

  it('decline and cancel resolve without forming a connection', async () => {
    const app = await buildApp();

    const declined = await auth(request(app).post('/connections/requests/r1/decline'));
    const cancelled = await auth(request(app).post('/connections/requests/r1/cancel'));

    expect(declined.body).toEqual({ success: true });
    expect(cancelled.body).toEqual({ success: true });
    expect(svc.acceptRequest).not.toHaveBeenCalled();
  });
});

// ============================================================
// Request listings
// ============================================================

describe('GET /connections/requests/{incoming,outgoing}', () => {
  it('resolves without a :userId segment and is not shadowed by GET /:id', async () => {
    const app = await buildApp();
    svc.getIncomingRequests.mockResolvedValue([{ id: 'r1' }]);

    const res = await auth(request(app).get('/connections/requests/incoming'));

    expect(res.status).toBe(200);
    expect(res.body.requests).toEqual([{ id: 'r1' }]);
    expect(svc.getConnectionDetail).not.toHaveBeenCalled();
  });

  it('lists incoming and outgoing for the authenticated user', async () => {
    const app = await buildApp();

    await auth(request(app).get('/connections/requests/incoming'));
    await auth(request(app).get('/connections/requests/outgoing'));

    expect(svc.getIncomingRequests).toHaveBeenCalledWith(USER_ID);
    expect(svc.getOutgoingRequests).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when a listing fails', async () => {
    const app = await buildApp();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    svc.getIncomingRequests.mockRejectedValue(new Error('db down'));

    const res = await auth(request(app).get('/connections/requests/incoming'));

    expect(res.status).toBe(500);
    logged.mockRestore();
  });
});

// ============================================================
// Connections list, detail, removal
// ============================================================

describe('connections list and detail', () => {
  it('returns the caller connections', async () => {
    const app = await buildApp();
    svc.getConnections.mockResolvedValue([{ id: 'c1', displayName: 'Ada' }]);

    const res = await auth(request(app).get('/connections'));

    expect(res.status).toBe(200);
    expect(res.body.connections).toEqual([{ id: 'c1', displayName: 'Ada' }]);
  });

  it('returns 404, not 403, for a connection the caller is not part of', async () => {
    const app = await buildApp();
    svc.getConnectionDetail.mockResolvedValue(null);

    const res = await auth(request(app).get('/connections/c1'));

    expect(res.status).toBe(404);
  });

  it('reveals the profile only for an existing connection', async () => {
    const app = await buildApp();
    const detail = { id: 'c1', connectedUserId: OTHER_ID, profile: { displayName: 'Ada' } };
    svc.getConnectionDetail.mockResolvedValue(detail);

    const res = await auth(request(app).get('/connections/c1'));

    expect(res.status).toBe(200);
    expect(res.body.connection).toEqual(detail);
  });

  it('re-anonymizes an existing connection on delete', async () => {
    const app = await buildApp();
    svc.removeConnection.mockResolvedValue(true);

    const res = await auth(request(app).delete('/connections/c1'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 404 when there is nothing to remove', async () => {
    const app = await buildApp();
    svc.removeConnection.mockResolvedValue(false);

    const res = await auth(request(app).delete('/connections/c1'));

    expect(res.status).toBe(404);
  });

  it('returns 500 when the lookup fails', async () => {
    const app = await buildApp();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    svc.getConnections.mockRejectedValue(new Error('db down'));

    const res = await auth(request(app).get('/connections'));

    expect(res.status).toBe(500);
    logged.mockRestore();
  });
});
