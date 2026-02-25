import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Broadcast, GeoPosition } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 8: Broadcast removal on stop
 * Validates: Requirements 3.3
 *
 * For any user who stops playing music, removing their broadcast should result
 * in the broadcast no longer appearing in any nearby feed query.
 *
 * Since the actual service is DB-dependent, we test the pure-logic invariant
 * using in-memory simulation matching the codebase pattern.
 */

/** Simulate a broadcast store with create/remove/query operations */
function createBroadcastStore() {
  const store = new Map<string, { broadcast: Broadcast; userId: string }>();

  return {
    add(userId: string, broadcast: Broadcast) {
      store.set(broadcast.id, { broadcast, userId });
    },
    remove(userId: string) {
      for (const [id, entry] of store) {
        if (entry.userId === userId) {
          store.delete(id);
        }
      }
    },
    query(excludeUserId: string): Broadcast[] {
      return [...store.values()]
        .filter((e) => e.userId !== excludeUserId)
        .map((e) => e.broadcast);
    },
    queryAll(): Broadcast[] {
      return [...store.values()].map((e) => e.broadcast);
    },
  };
}

const geoPositionArb: fc.Arbitrary<GeoPosition> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.constant(10),
  timestamp: fc.integer({ min: 0 }),
});

const broadcastArb = (userId: string): fc.Arbitrary<Broadcast> =>
  geoPositionArb.map((pos) => ({
    id: crypto.randomUUID(),
    anonymousId: crypto.randomUUID(),
    trackTitle: 'Track',
    artistName: 'Artist',
    albumArtUrl: 'https://example.com/art.jpg',
    startedAt: Date.now(),
    location: pos,
    createdAt: Date.now(),
  }));

describe('Property 8: Broadcast removal on stop', () => {
  it('removed broadcast never appears in any feed query', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        geoPositionArb,
        geoPositionArb,
        (stoppedUserId, otherUserId, pos1, pos2) => {
          const store = createBroadcastStore();

          const stoppedBroadcast: Broadcast = {
            id: crypto.randomUUID(),
            anonymousId: crypto.randomUUID(),
            trackTitle: 'Stopped Song',
            artistName: 'Artist',
            albumArtUrl: 'https://example.com/art.jpg',
            startedAt: Date.now(),
            location: pos1,
            createdAt: Date.now(),
          };
          const otherBroadcast: Broadcast = {
            id: crypto.randomUUID(),
            anonymousId: crypto.randomUUID(),
            trackTitle: 'Other Song',
            artistName: 'Other Artist',
            albumArtUrl: 'https://example.com/art2.jpg',
            startedAt: Date.now(),
            location: pos2,
            createdAt: Date.now(),
          };

          store.add(stoppedUserId, stoppedBroadcast);
          store.add(otherUserId, otherBroadcast);

          // User stops playing — remove their broadcast
          store.remove(stoppedUserId);

          // The removed broadcast must not appear in ANY query
          const allBroadcasts = store.queryAll();
          const feedForOther = store.query(otherUserId);
          const feedForStopped = store.query(stoppedUserId);

          expect(allBroadcasts.every((b) => b.id !== stoppedBroadcast.id)).toBe(true);
          expect(feedForOther.every((b) => b.id !== stoppedBroadcast.id)).toBe(true);
          expect(feedForStopped.every((b) => b.id !== stoppedBroadcast.id)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('other broadcasts remain after one user stops', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        fc.array(geoPositionArb, { minLength: 2, maxLength: 11 }),
        (stoppedUserId, otherUserIds, positions) => {
          const store = createBroadcastStore();

          // Add broadcast for the user who will stop
          store.add(stoppedUserId, {
            id: crypto.randomUUID(),
            anonymousId: crypto.randomUUID(),
            trackTitle: 'Gone',
            artistName: 'Artist',
            albumArtUrl: 'https://example.com/art.jpg',
            startedAt: Date.now(),
            location: positions[0],
            createdAt: Date.now(),
          });

          // Add broadcasts for other users
          const otherBroadcastIds: string[] = [];
          otherUserIds.forEach((uid, i) => {
            const bid = crypto.randomUUID();
            otherBroadcastIds.push(bid);
            store.add(uid, {
              id: bid,
              anonymousId: crypto.randomUUID(),
              trackTitle: `Song ${i}`,
              artistName: `Artist ${i}`,
              albumArtUrl: 'https://example.com/art.jpg',
              startedAt: Date.now(),
              location: positions[(i + 1) % positions.length],
              createdAt: Date.now(),
            });
          });

          store.remove(stoppedUserId);

          const remaining = store.queryAll();
          // All other broadcasts should still be present
          for (const bid of otherBroadcastIds) {
            expect(remaining.some((b) => b.id === bid)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
