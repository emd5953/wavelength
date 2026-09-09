/**
 * Feature: full-app-integration
 * HTTP-layer tests for the nearby feed route mounted behind authMiddleware.
 * Validates: Requirements 2.2, 2.3, 4.1–4.5 at the request/response boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockQuery = vi.fn();

vi.mock('../db/connection', () => ({
  default: { query: (...args: any[]) => mockQuery(...args) },
  pool: { query: (...args: any[]) => mockQuery(...args) },
}));

const mockGetBroadcastsInRadius = vi.fn();
vi.mock('../services/broadcastService', () => ({
  getBroadcastsInRadius: (...args: any[]) => mockGetBroadcastsInRadius(...args),
}));

const mockGetTasteScore = vi.fn();
vi.mock('../services/tasteService', () => ({
  getTasteScore: (...args: any[]) => mockGetTasteScore(...args),
}));

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'viewer-access-token';

async function buildApp() {
  const { authMiddleware } = await import('../middleware/auth');
  const { default: feedRouter } = await import('./feed');
  const app = express();
  app.use(express.json());
  app.use('/feed', authMiddleware, feedRouter);
  return app;
}

/** A broadcast row as broadcastService returns it. */
function broadcast(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    anonymousId: 'anon-1',
    userId: '22222222-2222-4222-8222-222222222222',
    trackTitle: 'Teardrop',
    artistName: 'Massive Attack',
    albumArtUrl: 'https://img/1',
    startedAt: Date.now() - 60_000,
    location: { latitude: 40.7128, longitude: -74.006, accuracy: 0, timestamp: 0 },
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  // authMiddleware resolves the bearer token to VIEWER_ID.
  mockQuery.mockResolvedValue({ rows: [{ id: VIEWER_ID }] });
  mockGetBroadcastsInRadius.mockReset();
  mockGetBroadcastsInRadius.mockResolvedValue([]);
  mockGetTasteScore.mockReset();
  mockGetTasteScore.mockResolvedValue(0);
});

function get(app: express.Express, query: string, token: string | null = TOKEN) {
  const req = request(app).get(`/feed/nearby${query}`);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

// ============================================================
// Auth boundary
// ============================================================

describe('GET /feed/nearby — auth', () => {
  it('rejects a request with no Authorization header', async () => {
    const app = await buildApp();
    const res = await get(app, '?lat=40&lng=-74', null);

    expect(res.status).toBe(401);
    expect(mockGetBroadcastsInRadius).not.toHaveBeenCalled();
  });

  it('rejects a bearer token that matches no user', async () => {
    const app = await buildApp();
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await get(app, '?lat=40&lng=-74', 'bogus');

    expect(res.status).toBe(401);
    expect(mockGetBroadcastsInRadius).not.toHaveBeenCalled();
  });
});

// ============================================================
// Input validation and radius clamping
// ============================================================

describe('GET /feed/nearby — coordinates and radius', () => {
  it('returns 400 when lat or lng is missing', async () => {
    const app = await buildApp();

    expect((await get(app, '')).status).toBe(400);
    expect((await get(app, '?lat=40')).status).toBe(400);
    expect((await get(app, '?lng=-74')).status).toBe(400);
    expect(mockGetBroadcastsInRadius).not.toHaveBeenCalled();
  });

  it('returns 400 when lat or lng is not a number', async () => {
    const app = await buildApp();
    const res = await get(app, '?lat=north&lng=-74');
    expect(res.status).toBe(400);
  });

  it('defaults to a 100m radius when none is given', async () => {
    const app = await buildApp();
    await get(app, '?lat=40&lng=-74');

    expect(mockGetBroadcastsInRadius.mock.calls[0][1]).toBe(100);
  });

  it('clamps a radius below the 50m floor', async () => {
    const app = await buildApp();
    await get(app, '?lat=40&lng=-74&radius=5');

    expect(mockGetBroadcastsInRadius.mock.calls[0][1]).toBe(50);
  });

  it('clamps a radius above the 500m ceiling', async () => {
    const app = await buildApp();
    await get(app, '?lat=40&lng=-74&radius=100000');

    expect(mockGetBroadcastsInRadius.mock.calls[0][1]).toBe(500);
  });

  it('passes a within-range radius through unchanged', async () => {
    const app = await buildApp();
    await get(app, '?lat=40&lng=-74&radius=250');

    expect(mockGetBroadcastsInRadius.mock.calls[0][1]).toBe(250);
  });
});

// ============================================================
// Self-exclusion and response shape
// ============================================================

describe('GET /feed/nearby — response', () => {
  it('passes the authenticated user id through for self-exclusion', async () => {
    const app = await buildApp();
    await get(app, '?lat=40&lng=-74');

    const [center, , excludeUserId] = mockGetBroadcastsInRadius.mock.calls[0];
    expect(excludeUserId).toBe(VIEWER_ID);
    expect(center.latitude).toBe(40);
    expect(center.longitude).toBe(-74);
  });

  it('never leaks a broadcaster userId to the client', async () => {
    const app = await buildApp();
    mockGetBroadcastsInRadius.mockResolvedValue([broadcast(), broadcast({ id: 'b2' })]);

    const res = await get(app, '?lat=40&lng=-74');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    for (const b of res.body.broadcasts) {
      expect(b.userId).toBeUndefined();
      expect(b.anonymousId).toBeTruthy();
    }
  });

  it('fuzzes the broadcast location away from the true coordinates', async () => {
    const app = await buildApp();
    const truth = { latitude: 40.7128, longitude: -74.006, accuracy: 0, timestamp: 0 };
    mockGetBroadcastsInRadius.mockResolvedValue([broadcast({ location: { ...truth } })]);

    const res = await get(app, '?lat=40&lng=-74');
    const returned = res.body.broadcasts[0].location;

    expect(returned.latitude).not.toBe(truth.latitude);
    expect(returned.longitude).not.toBe(truth.longitude);
    // Offset is 100–200m, so well under a tenth of a degree of latitude.
    expect(Math.abs(returned.latitude - truth.latitude)).toBeLessThan(0.01);
  });

  it('includes timeSinceStart and the taste score for each broadcast', async () => {
    const app = await buildApp();
    const startedAt = Date.now() - 30_000;
    mockGetBroadcastsInRadius.mockResolvedValue([broadcast({ startedAt })]);
    mockGetTasteScore.mockResolvedValue(42);

    const res = await get(app, '?lat=40&lng=-74');
    const item = res.body.broadcasts[0];

    expect(item.tasteScore).toBe(42);
    expect(item.timeSinceStart).toBeGreaterThanOrEqual(30_000);
  });

  it('scores taste between the viewer and each broadcaster', async () => {
    const app = await buildApp();
    const otherId = '33333333-3333-4333-8333-333333333333';
    mockGetBroadcastsInRadius.mockResolvedValue([broadcast({ userId: otherId })]);

    await get(app, '?lat=40&lng=-74');

    expect(mockGetTasteScore).toHaveBeenCalledWith(VIEWER_ID, otherId);
  });

  it('returns an empty feed rather than an error when nothing is nearby', async () => {
    const app = await buildApp();
    const res = await get(app, '?lat=40&lng=-74');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ broadcasts: [], count: 0 });
  });

  it('returns 500 when the broadcast lookup fails', async () => {
    const app = await buildApp();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetBroadcastsInRadius.mockRejectedValue(new Error('postgis down'));

    const res = await get(app, '?lat=40&lng=-74');

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
    logged.mockRestore();
  });
});
