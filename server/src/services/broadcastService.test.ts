import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import type { Broadcast, CurrentTrack, GeoPosition } from '../types';

/**
 * BroadcastService unit tests.
 *
 * Since the actual service functions are DB-dependent (PostGIS),
 * we test the pure-logic invariants using in-memory simulation,
 * matching the pattern used in feedLocation.test.ts.
 */

/** Simulate anonymous ID generation (same as createBroadcast uses) */
function generateAnonymousId(): string {
  return randomUUID();
}

/** Simulate self-exclusion filtering (same logic as getBroadcastsInRadius) */
function filterBroadcasts(
  broadcasts: { broadcast: Broadcast; userId: string }[],
  excludeUserId: string,
): Broadcast[] {
  return broadcasts
    .filter((entry) => entry.userId !== excludeUserId)
    .map((entry) => entry.broadcast);
}

/** Simulate stale broadcast expiry */
function expireStale(
  broadcasts: { broadcast: Broadcast; createdAt: number }[],
  nowMs: number,
  thresholdMs: number,
): { kept: typeof broadcasts; expired: typeof broadcasts } {
  const kept = broadcasts.filter((b) => nowMs - b.createdAt < thresholdMs);
  const expired = broadcasts.filter((b) => nowMs - b.createdAt >= thresholdMs);
  return { kept, expired };
}

describe('BroadcastService — anonymous ID generation', () => {
  it('generates unique anonymous IDs across multiple calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateAnonymousId());
    }
    expect(ids.size).toBe(1000);
  });

  it('anonymous ID does not contain the user ID', () => {
    const userId = 'real-user-id-12345';
    const spotifyUserId = 'spotify:user:abc123';
    for (let i = 0; i < 100; i++) {
      const anonId = generateAnonymousId();
      expect(anonId).not.toContain(userId);
      expect(anonId).not.toContain(spotifyUserId);
    }
  });
});


describe('BroadcastService — self-exclusion from feed', () => {
  const makeBroadcast = (userId: string): { broadcast: Broadcast; userId: string } => ({
    userId,
    broadcast: {
      id: randomUUID(),
      anonymousId: randomUUID(),
      trackTitle: 'Song',
      artistName: 'Artist',
      albumArtUrl: 'https://example.com/art.jpg',
      startedAt: Date.now(),
      location: { latitude: 0, longitude: 0, accuracy: 10, timestamp: Date.now() },
      createdAt: Date.now(),
    },
  });

  it('excludes the requesting user own broadcast', () => {
    const myUserId = 'user-me';
    const entries = [
      makeBroadcast(myUserId),
      makeBroadcast('user-a'),
      makeBroadcast('user-b'),
    ];

    const results = filterBroadcasts(entries, myUserId);
    expect(results.length).toBe(2);
    expect(results.every((b) => b.id !== entries[0].broadcast.id)).toBe(true);
  });

  it('returns all broadcasts when excludeUserId has no broadcast', () => {
    const entries = [
      makeBroadcast('user-a'),
      makeBroadcast('user-b'),
    ];

    const results = filterBroadcasts(entries, 'user-nobody');
    expect(results.length).toBe(2);
  });
});

describe('BroadcastService — stale broadcast expiry', () => {
  it('removes broadcasts older than 30 seconds', () => {
    const now = Date.now();
    const entries = [
      { broadcast: { id: '1' } as Broadcast, createdAt: now - 31_000 }, // stale
      { broadcast: { id: '2' } as Broadcast, createdAt: now - 10_000 }, // fresh
      { broadcast: { id: '3' } as Broadcast, createdAt: now - 30_000 }, // exactly at threshold
    ];

    const { kept, expired } = expireStale(entries, now, 30_000);
    expect(expired.length).toBe(2); // 31s and exactly 30s
    expect(kept.length).toBe(1);
    expect(kept[0].broadcast.id).toBe('2');
  });

  it('keeps all broadcasts when none are stale', () => {
    const now = Date.now();
    const entries = [
      { broadcast: { id: '1' } as Broadcast, createdAt: now - 5_000 },
      { broadcast: { id: '2' } as Broadcast, createdAt: now - 1_000 },
    ];

    const { kept, expired } = expireStale(entries, now, 30_000);
    expect(expired.length).toBe(0);
    expect(kept.length).toBe(2);
  });
});
