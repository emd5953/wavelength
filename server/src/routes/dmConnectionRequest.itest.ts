/**
 * Feature: send-connection-requests
 * POST /social/dms with "ask to connect", end to end through the real auth
 * middleware, session lookup, and Postgres. Spec: docs/specs/send-connection-requests.md
 *
 * Run with `npm run test:integration` (needs `docker compose up -d postgres`).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import pool from '../db/connection';
import { runMigrations } from '../db/migrate';
import { authMiddleware } from '../middleware/auth';
import { touchPresence } from '../services/sessionService';
import socialRouter from './social';

const TAG = `itest-dmcr-${process.pid}-${Date.now()}`;

const app = express();
app.use(express.json());
app.use('/social', authMiddleware, socialRouter);

/** A user whose bearer token is `${TAG}-${label}-token`. */
async function insertUser(label: string): Promise<{ id: string; token: string }> {
  const token = `${TAG}-${label}-token`;
  const res = await pool.query(
    `INSERT INTO users (spotify_user_id, encrypted_access_token, encrypted_refresh_token, token_expires_at)
     VALUES ($1, $2, 'x', NOW() + INTERVAL '1 hour') RETURNING id`,
    [`${TAG}-${label}`, token],
  );
  return { id: res.rows[0].id, token };
}

async function pendingRequests(viewer: string, broadcaster: string): Promise<number> {
  const res = await pool.query(
    `SELECT count(*)::int AS n FROM connection_requests
     WHERE viewer_user_id = $1 AND broadcaster_user_id = $2 AND status = 'pending'`,
    [viewer, broadcaster],
  );
  return res.rows[0].n;
}

function dm(token: string, body: Record<string, unknown>) {
  return request(app).post('/social/dms').set('Authorization', `Bearer ${token}`).send(body);
}

async function cleanup() {
  await pool.query('DELETE FROM direct_messages WHERE text LIKE $1', [`${TAG}%`]);
  await pool.query('DELETE FROM users WHERE spotify_user_id LIKE $1', [`${TAG}-%`]);
}

beforeAll(async () => {
  await runMigrations();
  await cleanup();
}, 60_000);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

beforeEach(cleanup);

describe('POST /social/dms with includesConnectionRequest', () => {
  it('creates exactly one pending request, even when asked twice', async () => {
    const asker = await insertUser('asker');
    const listener = await insertUser('listener');
    const { anonymousId: listenerAnon } = await touchPresence(listener.id);

    const first = await dm(asker.token, {
      recipientAnonId: listenerAnon,
      text: `${TAG} love this`,
      includesConnectionRequest: true,
    });
    const second = await dm(asker.token, {
      recipientAnonId: listenerAnon,
      text: `${TAG} still keen`,
      includesConnectionRequest: true,
    });

    expect(first.status).toBe(200);
    expect(first.body.connectionRequest).toBe('sent');
    expect(second.status).toBe(200);
    expect(second.body.connectionRequest).toBe('already_pending');
    expect(await pendingRequests(asker.id, listener.id)).toBe(1);

    // Both DMs were saved and flagged
    const dms = await pool.query(
      'SELECT includes_connection_request FROM direct_messages WHERE text LIKE $1',
      [`${TAG}%`],
    );
    expect(dms.rows.map((r) => r.includes_connection_request)).toEqual([true, true]);
  });

  it('creates no request when the flag is off', async () => {
    const asker = await insertUser('quiet');
    const listener = await insertUser('quietlistener');
    const { anonymousId } = await touchPresence(listener.id);

    const res = await dm(asker.token, { recipientAnonId: anonymousId, text: `${TAG} hi` });

    expect(res.status).toBe(200);
    expect(await pendingRequests(asker.id, listener.id)).toBe(0);
  });
});
