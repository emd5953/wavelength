/**
 * Feature: full-app-integration
 * HTTP-layer tests for the social router — reactions, comments, DMs.
 * Validates: Requirements 5.1–5.5 at the request/response boundary.
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
  addReaction: vi.fn(),
  getReactionCounts: vi.fn(),
  addComment: vi.fn(),
  getComments: vi.fn(),
  sendDM: vi.fn(),
  getDMThread: vi.fn(),
};

vi.mock('../services/socialService', () => ({
  addReaction: (...a: any[]) => svc.addReaction(...a),
  getReactionCounts: (...a: any[]) => svc.getReactionCounts(...a),
  addComment: (...a: any[]) => svc.addComment(...a),
  getComments: (...a: any[]) => svc.getComments(...a),
  sendDM: (...a: any[]) => svc.sendDM(...a),
  getDMThread: (...a: any[]) => svc.getDMThread(...a),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'user-access-token';
const VALID_REACTIONS = ['fire', 'heart', 'headphones', 'clap', 'surprised'];

async function buildApp() {
  const { authMiddleware } = await import('../middleware/auth');
  const { default: socialRouter } = await import('./social');
  const app = express();
  app.use(express.json());
  app.use('/social', authMiddleware, socialRouter);
  return app;
}

const auth = (r: request.Test) => r.set('Authorization', `Bearer ${TOKEN}`);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [{ id: USER_ID }] });
  for (const fn of Object.values(svc)) fn.mockReset();
});

// ============================================================
// Auth boundary
// ============================================================

describe('social router — auth', () => {
  it('rejects unauthenticated writes', async () => {
    const app = await buildApp();

    const responses = await Promise.all([
      request(app).post('/social/reactions').send({ broadcastId: 'b1', viewerAnonId: 'anon', type: 'fire' }),
      request(app).post('/social/comments').send({ broadcastId: 'b1', authorAnonId: 'anon', text: 'hi' }),
      request(app).post('/social/dms').send({ senderAnonId: 'a', recipientAnonId: 'b', text: 'hi' }),
    ]);

    for (const res of responses) expect(res.status).toBe(401);
    expect(svc.addReaction).not.toHaveBeenCalled();
    expect(svc.addComment).not.toHaveBeenCalled();
    expect(svc.sendDM).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated reads', async () => {
    const app = await buildApp();
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/social/comments/b1').set('Authorization', 'Bearer bogus');

    expect(res.status).toBe(401);
    expect(svc.getComments).not.toHaveBeenCalled();
  });
});

// ============================================================
// Reactions
// ============================================================

describe('POST /social/reactions', () => {
  it('requires broadcastId, viewerAnonId, and type', async () => {
    const app = await buildApp();

    for (const body of [
      { viewerAnonId: 'anon', type: 'fire' },
      { broadcastId: 'b1', type: 'fire' },
      { broadcastId: 'b1', viewerAnonId: 'anon' },
    ]) {
      const res = await auth(request(app).post('/social/reactions')).send(body);
      expect(res.status).toBe(400);
    }
    expect(svc.addReaction).not.toHaveBeenCalled();
  });

  it('rejects a reaction type outside the allowed set', async () => {
    const app = await buildApp();

    const res = await auth(request(app).post('/social/reactions')).send({
      broadcastId: 'b1',
      viewerAnonId: 'anon',
      type: 'thumbsdown',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid reaction type');
    expect(svc.addReaction).not.toHaveBeenCalled();
  });

  it('accepts every documented reaction type', async () => {
    const app = await buildApp();
    svc.addReaction.mockResolvedValue({ fire: 1 });

    for (const type of VALID_REACTIONS) {
      const res = await auth(request(app).post('/social/reactions')).send({
        broadcastId: 'b1',
        viewerAnonId: 'anon',
        type,
      });
      expect(res.status).toBe(200);
    }
    expect(svc.addReaction).toHaveBeenCalledTimes(VALID_REACTIONS.length);
  });

  it('returns the updated counts', async () => {
    const app = await buildApp();
    svc.addReaction.mockResolvedValue({ fire: 3, heart: 1 });

    const res = await auth(request(app).post('/social/reactions')).send({
      broadcastId: 'b1',
      viewerAnonId: 'anon-1',
      type: 'fire',
    });

    expect(res.body.counts).toEqual({ fire: 3, heart: 1 });
    expect(svc.addReaction).toHaveBeenCalledWith('b1', 'anon-1', 'fire');
  });

  it('returns 500 when the write fails', async () => {
    const app = await buildApp();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    svc.addReaction.mockRejectedValue(new Error('db down'));

    const res = await auth(request(app).post('/social/reactions')).send({
      broadcastId: 'b1',
      viewerAnonId: 'anon',
      type: 'fire',
    });

    expect(res.status).toBe(500);
    logged.mockRestore();
  });
});

describe('GET /social/reactions/:broadcastId', () => {
  it('returns counts for the broadcast', async () => {
    const app = await buildApp();
    svc.getReactionCounts.mockResolvedValue({ clap: 2 });

    const res = await auth(request(app).get('/social/reactions/b1'));

    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ clap: 2 });
    expect(svc.getReactionCounts).toHaveBeenCalledWith('b1');
  });
});

// ============================================================
// Comments
// ============================================================

describe('comments', () => {
  it('requires broadcastId, authorAnonId, and text', async () => {
    const app = await buildApp();

    for (const body of [
      { authorAnonId: 'anon', text: 'hi' },
      { broadcastId: 'b1', text: 'hi' },
      { broadcastId: 'b1', authorAnonId: 'anon' },
      { broadcastId: 'b1', authorAnonId: 'anon', text: '' },
    ]) {
      const res = await auth(request(app).post('/social/comments')).send(body);
      expect(res.status).toBe(400);
    }
    expect(svc.addComment).not.toHaveBeenCalled();
  });

  it('stores a comment against its anon author', async () => {
    const app = await buildApp();
    svc.addComment.mockResolvedValue({ id: 'cm1', authorAnonId: 'anon-1', text: 'great track' });

    const res = await auth(request(app).post('/social/comments')).send({
      broadcastId: 'b1',
      authorAnonId: 'anon-1',
      text: 'great track',
    });

    expect(res.status).toBe(200);
    expect(res.body.comment.id).toBe('cm1');
    expect(svc.addComment).toHaveBeenCalledWith('b1', 'anon-1', 'great track');
    // The comment payload carries no real user identity.
    expect(JSON.stringify(res.body)).not.toContain(USER_ID);
  });

  it('returns the thread for a broadcast', async () => {
    const app = await buildApp();
    svc.getComments.mockResolvedValue([{ id: 'cm1' }, { id: 'cm2' }]);

    const res = await auth(request(app).get('/social/comments/b1'));

    expect(res.body.comments).toHaveLength(2);
    expect(svc.getComments).toHaveBeenCalledWith('b1');
  });
});

// ============================================================
// DMs
// ============================================================

describe('DMs', () => {
  it('requires sender, recipient, and text', async () => {
    const app = await buildApp();

    for (const body of [
      { recipientAnonId: 'b', text: 'hi' },
      { senderAnonId: 'a', text: 'hi' },
      { senderAnonId: 'a', recipientAnonId: 'b' },
    ]) {
      const res = await auth(request(app).post('/social/dms')).send(body);
      expect(res.status).toBe(400);
    }
    expect(svc.sendDM).not.toHaveBeenCalled();
  });

  it('defaults includesConnectionRequest to false', async () => {
    const app = await buildApp();
    svc.sendDM.mockResolvedValue({ id: 'dm1' });

    await auth(request(app).post('/social/dms')).send({
      senderAnonId: 'anon-a',
      recipientAnonId: 'anon-b',
      text: 'hey',
    });

    expect(svc.sendDM).toHaveBeenCalledWith('anon-a', 'anon-b', 'hey', false);
  });

  it('forwards a truthy connection-request flag as a boolean', async () => {
    const app = await buildApp();
    svc.sendDM.mockResolvedValue({ id: 'dm1' });

    await auth(request(app).post('/social/dms')).send({
      senderAnonId: 'anon-a',
      recipientAnonId: 'anon-b',
      text: 'hey',
      includesConnectionRequest: 'yes',
    });

    expect(svc.sendDM).toHaveBeenCalledWith('anon-a', 'anon-b', 'hey', true);
  });

  it('returns the thread between two anon participants', async () => {
    const app = await buildApp();
    svc.getDMThread.mockResolvedValue([{ id: 'dm1' }]);

    const res = await auth(request(app).get('/social/dms/anon-a/anon-b'));

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(svc.getDMThread).toHaveBeenCalledWith('anon-a', 'anon-b');
  });

  it('returns 500 when the thread lookup fails', async () => {
    const app = await buildApp();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    svc.getDMThread.mockRejectedValue(new Error('db down'));

    const res = await auth(request(app).get('/social/dms/anon-a/anon-b'));

    expect(res.status).toBe(500);
    logged.mockRestore();
  });
});
