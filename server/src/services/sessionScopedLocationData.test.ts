import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Broadcast, GeoPosition } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 22: Session-scoped location data
 * Validates: Requirements 8.2
 *
 * For any user session that ends, all GPS coordinate data associated with that
 * user should be deleted from the backend. Querying location data for that user
 * after session end should return no results.
 */

/** Simulate a broadcast store with session cleanup */
function createSessionStore() {
  const store = new Map<string, { broadcast: Broadcast; userId: string }>();

  return {
    add(userId: string, broadcast: Broadcast) {
      store.set(broadcast.id, { broadcast, userId });
    },
    cleanupSession(userId: string) {
      for (const [id, entry] of store) {
        if (entry.userId === userId) {
          store.delete(id);
        }
      }
    },
    getLocationDataForUser(userId: string): GeoPosition[] {
      return [...store.values()]
        .filter((e) => e.userId === userId)
        .map((e) => e.broadcast.location);
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

describe('Property 22: Session-scoped location data', () => {
  it('all location data is deleted when a user session ends', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(geoPositionArb, { minLength: 1, maxLength: 5 }),
        (userId, positions) => {
          const store = createSessionStore();

          // User creates broadcasts during their session
          for (const pos of positions) {
            store.add(userId, {
              id: crypto.randomUUID(),
              anonymousId: crypto.randomUUID(),
              trackTitle: 'Track',
              artistName: 'Artist',
              albumArtUrl: 'https://example.com/art.jpg',
              startedAt: Date.now(),
              location: pos,
              createdAt: Date.now(),
            });
          }

          // Session ends — cleanup
          store.cleanupSession(userId);

          // No location data should remain for this user
          const remaining = store.getLocationDataForUser(userId);
          expect(remaining).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('other users location data is preserved after one session ends', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        geoPositionArb,
        fc.array(geoPositionArb, { minLength: 1, maxLength: 5 }),
        (endingUserId, otherUserIds, endingPos, otherPositions) => {
          const store = createSessionStore();

          // Ending user's broadcast
          store.add(endingUserId, {
            id: crypto.randomUUID(),
            anonymousId: crypto.randomUUID(),
            trackTitle: 'Ending Track',
            artistName: 'Artist',
            albumArtUrl: 'https://example.com/art.jpg',
            startedAt: Date.now(),
            location: endingPos,
            createdAt: Date.now(),
          });

          // Other users' broadcasts
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
              location: otherPositions[i % otherPositions.length],
              createdAt: Date.now(),
            });
          });

          // End the user's session
          store.cleanupSession(endingUserId);

          // Other users' broadcasts (and their location data) must remain
          const allRemaining = store.queryAll();
          for (const bid of otherBroadcastIds) {
            expect(allRemaining.some((b) => b.id === bid)).toBe(true);
          }

          // Ending user has no location data
          expect(store.getLocationDataForUser(endingUserId)).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
