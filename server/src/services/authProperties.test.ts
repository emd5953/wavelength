/**
 * Feature: full-app-integration
 * Property tests for Auth Router and Auth Middleware
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import express, { Request, Response } from 'express';
import request from 'supertest';

// --- Shared arbitraries ---

const tokenStringArb = fc.string({ minLength: 10, maxLength: 64 }).filter(s => /^[a-zA-Z0-9]+$/.test(s));
const spotifyUserIdArb = fc.string({ minLength: 5, maxLength: 30 }).filter(s => /^[a-zA-Z0-9]+$/.test(s));
const expiresInArb = fc.integer({ min: 60, max: 7200 });
const userIdArb = fc.uuid();

// --- Mock DB pool ---

const mockQuery = vi.fn();

vi.mock('../db/connection', () => ({
  default: { query: (...args: any[]) => mockQuery(...args) },
  pool: { query: (...args: any[]) => mockQuery(...args) },
}));

// --- Mock global fetch ---

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockQuery.mockReset();
  mockFetch.mockReset();
  installFetchFallback();
});

/**
 * Routes fire background work (e.g. syncUserTaste) that issues its own Spotify
 * calls beyond the ones each property queues. Give those a terminal `ok: false`
 * so they no-op instead of dereferencing an undefined response.
 */
function installFetchFallback() {
  mockFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as any);
}

// ============================================================
// Property 1: Auth code exchange round-trip
// ============================================================

describe('Property 1: Auth code exchange round-trip', () => {
  /**
   * Validates: Requirements 1.1
   *
   * For any valid Spotify token response, the upserted DB record
   * SHALL contain the same access token, refresh token, and matching expiry.
   */
  it('upserted DB record matches Spotify token response', async () => {
    const { default: authRouter } = await import('../routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);

    await fc.assert(
      fc.asyncProperty(
        tokenStringArb, tokenStringArb, spotifyUserIdArb, expiresInArb, userIdArb,
        async (accessToken, refreshToken, spotifyId, expiresIn, dbId) => {
          mockFetch.mockReset();
        installFetchFallback();
          installFetchFallback();
          mockQuery.mockReset();

          // Spotify token endpoint
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn }),
          } as any);

          // Spotify /me endpoint
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: spotifyId }),
          } as any);

          // DB upsert
          mockQuery.mockResolvedValueOnce({ rows: [{ id: dbId }] });

          const res = await request(app)
            .post('/auth/callback')
            .send({ code: 'test-code', redirectUri: 'http://localhost' });

          expect(res.status).toBe(200);

          // Verify DB params
          const [, params] = mockQuery.mock.calls[0];
          expect(params[0]).toBe(spotifyId);
          expect(params[1]).toBe(accessToken);
          expect(params[2]).toBe(refreshToken);

          // Verify response
          expect(res.body.accessToken).toBe(accessToken);
          expect(res.body.refreshToken).toBe(refreshToken);
          expect(res.body.userId).toBe(dbId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 2: Token refresh updates stored credentials
// ============================================================

describe('Property 2: Token refresh updates stored credentials', () => {
  /**
   * Validates: Requirements 1.2
   *
   * For any refresh, the DB update SHALL use the new access token
   * and the response SHALL match.
   */
  it('DB update and response match Spotify refresh response', async () => {
    const { default: authRouter } = await import('../routes/auth');
    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);

    await fc.assert(
      fc.asyncProperty(
        tokenStringArb, tokenStringArb, expiresInArb,
        async (newAccessToken, oldRefreshToken, expiresIn) => {
          mockFetch.mockReset();
        installFetchFallback();
          installFetchFallback();
          mockQuery.mockReset();

          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: newAccessToken, expires_in: expiresIn }),
          } as any);

          mockQuery.mockResolvedValueOnce({ rowCount: 1 });

          const res = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: oldRefreshToken });

          expect(res.status).toBe(200);

          const [, params] = mockQuery.mock.calls[0];
          expect(params[0]).toBe(newAccessToken);
          expect(params[2]).toBe(oldRefreshToken);

          expect(res.body.accessToken).toBe(newAccessToken);
          expect(typeof res.body.expiresAt).toBe('number');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 3: Valid token authentication
// ============================================================

describe('Property 3: Valid token authentication', () => {
  /**
   * Validates: Requirements 2.1
   *
   * For any user record, when a request includes that user's stored
   * access token, the middleware SHALL set req.userId and pass through.
   */
  it('valid token sets req.userId and passes through', async () => {
    const { authMiddleware } = await import('../middleware/auth');
    const app = express();
    app.use('/protected', authMiddleware, (_req: Request, res: Response) => {
      res.json({ userId: _req.userId });
    });

    await fc.assert(
      fc.asyncProperty(tokenStringArb, userIdArb, async (token, userId) => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValueOnce({ rows: [{ id: userId }] });

        const res = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.userId).toBe(userId);
        expect(mockQuery.mock.calls[0][1][0]).toBe(token);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 4: Invalid token rejection
// ============================================================

describe('Property 4: Invalid token rejection', () => {
  /**
   * Validates: Requirements 2.2
   *
   * For any string that does not match any stored access token,
   * the middleware SHALL return 401 and SHALL NOT invoke the handler.
   */
  it('unrecognized token returns 401', async () => {
    const { authMiddleware } = await import('../middleware/auth');
    let handlerCalled = false;
    const app = express();
    app.use('/protected', authMiddleware, (_req: Request, res: Response) => {
      handlerCalled = true;
      res.json({ ok: true });
    });

    await fc.assert(
      fc.asyncProperty(tokenStringArb, async (token) => {
        mockQuery.mockReset();
        handlerCalled = false;
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
        expect(handlerCalled).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('missing Authorization header returns 401', async () => {
    const { authMiddleware } = await import('../middleware/auth');
    let handlerCalled = false;
    const app = express();
    app.use('/protected', authMiddleware, (_req: Request, res: Response) => {
      handlerCalled = true;
      res.json({ ok: true });
    });

    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(handlerCalled).toBe(false);
  });
});
