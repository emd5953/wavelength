/**
 * Feature: connection-chat
 * Chat between connected users against real Postgres. Spec: docs/specs/connection-chat.md
 *
 * Run with `npm run test:integration` (needs `docker compose up -d postgres`).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pool from '../db/connection';
import { runMigrations } from '../db/migrate';
import {
  sendRequest,
  acceptRequest,
  removeConnection,
  getConnectionMessages,
  sendConnectionMessage,
} from './connectionService';

const TAG = `itest-chat-${process.pid}-${Date.now()}`;

async function insertUser(label: string): Promise<string> {
  const res = await pool.query(
    `INSERT INTO users (spotify_user_id, encrypted_access_token, encrypted_refresh_token, token_expires_at)
     VALUES ($1, $2, 'x', NOW() + INTERVAL '1 hour') RETURNING id`,
    [`${TAG}-${label}`, `${TAG}-${label}-token`],
  );
  return res.rows[0].id;
}

/** Two users with an accepted connection. */
async function connectedPair() {
  const a = await insertUser('a');
  const b = await insertUser('b');
  const req = await sendRequest(a, b);
  const connection = await acceptRequest(req.id, b);
  return { a, b, connectionId: connection.id };
}

async function cleanup() {
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

describe('connection chat', () => {
  it('both people read the same thread, each seeing their own messages as mine', async () => {
    const { a, b, connectionId } = await connectedPair();

    await sendConnectionMessage(connectionId, a, 'that burial track though');
    await sendConnectionMessage(connectionId, b, 'archangel forever');

    const fromA = await getConnectionMessages(connectionId, a);
    const fromB = await getConnectionMessages(connectionId, b);

    expect(fromA!.map((m) => [m.text, m.mine])).toEqual([
      ['that burial track though', true],
      ['archangel forever', false],
    ]);
    expect(fromB!.map((m) => m.mine)).toEqual([false, true]);
  });

  it('an outsider can neither read nor send', async () => {
    const { connectionId } = await connectedPair();
    const outsider = await insertUser('outsider');

    await expect(getConnectionMessages(connectionId, outsider)).resolves.toBeNull();
    await expect(sendConnectionMessage(connectionId, outsider, 'hi')).resolves.toBeNull();
  });

  it('removing the connection deletes its chat', async () => {
    const { a, connectionId } = await connectedPair();
    await sendConnectionMessage(connectionId, a, 'hello');

    await removeConnection(connectionId, a);

    const left = await pool.query('SELECT 1 FROM connection_messages WHERE connection_id = $1', [connectionId]);
    expect(left.rows).toHaveLength(0);
  });
});
