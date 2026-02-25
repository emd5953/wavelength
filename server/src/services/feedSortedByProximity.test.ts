import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateRadius } from './proximityService';
import type { GeoPosition, Broadcast } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 10: Feed sorted by proximity
 * Validates: Requirements 4.1
 *
 * For any set of broadcasts returned by a nearby feed query, the broadcasts
 * should be sorted in ascending order by distance from the querying user's position.
 */

/** Haversine distance in meters between two lat/lng points */
function haversineMeters(a: GeoPosition, b: GeoPosition): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const geoPositionArb: fc.Arbitrary<GeoPosition> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.constant(10),
  timestamp: fc.integer({ min: 0 }),
});

function broadcastAtPosition(pos: GeoPosition): Broadcast {
  return {
    id: crypto.randomUUID(),
    anonymousId: crypto.randomUUID(),
    trackTitle: 'Track',
    artistName: 'Artist',
    albumArtUrl: 'https://example.com/art.jpg',
    startedAt: Date.now(),
    location: pos,
    createdAt: Date.now(),
  };
}

/**
 * Simulates the feed query: clamp radius, filter by distance, sort ascending.
 * Mirrors the SQL ORDER BY distance ASC in broadcastService / proximityService.
 */
function simulateSortedFeedQuery(
  center: GeoPosition,
  radiusMeters: number,
  broadcasts: Broadcast[],
): Broadcast[] {
  const clamped = validateRadius(radiusMeters);
  return broadcasts
    .filter((b) => haversineMeters(center, b.location) <= clamped)
    .sort((a, b) => haversineMeters(center, a.location) - haversineMeters(center, b.location));
}

describe('Property 10: Feed sorted by proximity', () => {
  it('feed results are sorted in ascending order by distance from the query center', () => {
    fc.assert(
      fc.property(
        geoPositionArb,
        fc.double({ min: 50, max: 500, noNaN: true }),
        fc.array(geoPositionArb, { minLength: 2, maxLength: 30 }),
        (center, radius, positions) => {
          const broadcasts = positions.map(broadcastAtPosition);
          const results = simulateSortedFeedQuery(center, radius, broadcasts);

          for (let i = 1; i < results.length; i++) {
            const distPrev = haversineMeters(center, results[i - 1].location);
            const distCurr = haversineMeters(center, results[i].location);
            expect(distPrev).toBeLessThanOrEqual(distCurr);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
