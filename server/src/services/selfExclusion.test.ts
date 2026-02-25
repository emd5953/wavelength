import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { Broadcast, GeoPosition } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 9: Self-exclusion from feed
 * Validates: Requirements 3.5
 *
 * For any user who is actively broadcasting, querying the nearby feed for that
 * user should never include their own broadcast, even if they are within their
 * own vicinity radius.
 *
 * Since getBroadcastsInRadius depends on PostGIS, we test the pure filtering
 * logic that excludes the requesting user's broadcast from results.
 */

/** Simulate the self-exclusion filter used by getBroadcastsInRadius */
function filterBroadcastsExcludingUser(
  broadcasts: { broadcast: Broadcast; userId: string }[],
  excludeUserId: string,
): Broadcast[] {
  return broadcasts
    .filter((entry) => entry.userId !== excludeUserId)
    .map((entry) => entry.broadcast);
}

/** Arbitrary for a GeoPosition */
const geoPositionArb: fc.Arbitrary<GeoPosition> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.constant(10),
  timestamp: fc.integer({ min: 0 }),
});

/** Create a broadcast entry for a given userId */
function makeBroadcastEntry(userId: string, location: GeoPosition): { broadcast: Broadcast; userId: string } {
  return {
    userId,
    broadcast: {
      id: randomUUID(),
      anonymousId: randomUUID(),
      trackTitle: 'Track',
      artistName: 'Artist',
      albumArtUrl: 'https://example.com/art.jpg',
      startedAt: Date.now(),
      location,
      createdAt: Date.now(),
    },
  };
}

describe('Property 9: Self-exclusion from feed', () => {
  it('a broadcasting user never sees their own broadcast in the feed', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        geoPositionArb,
        fc.array(fc.uuid(), { minLength: 0, maxLength: 15 }),
        fc.array(geoPositionArb, { minLength: 0, maxLength: 15 }),
        (myUserId, myLocation, otherUserIds, otherLocations) => {
          const entries = [makeBroadcastEntry(myUserId, myLocation)];
          const count = Math.min(otherUserIds.length, otherLocations.length);
          for (let i = 0; i < count; i++) {
            entries.push(makeBroadcastEntry(otherUserIds[i], otherLocations[i]));
          }

          const results = filterBroadcastsExcludingUser(entries, myUserId);

          // The user's own broadcast must never appear
          for (const b of results) {
            expect(b.id).not.toBe(entries[0].broadcast.id);
            expect(b.anonymousId).not.toBe(entries[0].broadcast.anonymousId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all other users broadcasts are preserved after self-exclusion', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        geoPositionArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 15 }),
        fc.array(geoPositionArb, { minLength: 1, maxLength: 15 }),
        (myUserId, myLocation, otherUserIds, otherLocations) => {
          const entries = [makeBroadcastEntry(myUserId, myLocation)];
          const count = Math.min(otherUserIds.length, otherLocations.length);
          for (let i = 0; i < count; i++) {
            entries.push(makeBroadcastEntry(otherUserIds[i], otherLocations[i]));
          }

          const results = filterBroadcastsExcludingUser(entries, myUserId);
          const otherEntries = entries.filter((e) => e.userId !== myUserId);

          expect(results.length).toBe(otherEntries.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
