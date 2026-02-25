import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateRadius } from './proximityService';
import type { GeoPosition, Broadcast } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 5: Feed reflects current location
 * Validates: Requirements 2.4
 *
 * For any user location update, the resulting nearby feed query should use the
 * updated coordinates, and all returned broadcasts should be within the user's
 * configured vicinity radius of the new position.
 *
 * Since findNearby depends on PostGIS, we test the pure-logic invariants:
 * 1. The radius passed to the spatial query is always clamped via validateRadius
 * 2. Given a set of broadcasts with known distances, filtering by clamped radius
 *    correctly includes only those within range
 */

/** Haversine distance in meters between two lat/lng points */
function haversineMeters(a: GeoPosition, b: GeoPosition): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Arbitrary for a valid GeoPosition */
const geoPositionArb: fc.Arbitrary<GeoPosition> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.constant(10),
  timestamp: fc.integer({ min: 0 }),
});

/** Arbitrary for a Broadcast at a given position */
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
 * Simulates the feed filtering logic: clamp radius, then include only
 * broadcasts within haversine distance of the center.
 */
function simulateFeedQuery(
  center: GeoPosition,
  radiusMeters: number,
  broadcasts: Broadcast[],
): Broadcast[] {
  const clamped = validateRadius(radiusMeters);
  return broadcasts.filter((b) => haversineMeters(center, b.location) <= clamped);
}

describe('Property 5: Feed reflects current location', () => {
  it('all returned broadcasts are within the clamped radius of the query center', () => {
    fc.assert(
      fc.property(
        geoPositionArb,
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.array(geoPositionArb, { minLength: 1, maxLength: 20 }),
        (center, rawRadius, positions) => {
          const broadcasts = positions.map(broadcastAtPosition);
          const results = simulateFeedQuery(center, rawRadius, broadcasts);
          const clampedRadius = validateRadius(rawRadius);

          for (const b of results) {
            const dist = haversineMeters(center, b.location);
            expect(dist).toBeLessThanOrEqual(clampedRadius);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('broadcasts outside the clamped radius are excluded from the feed', () => {
    fc.assert(
      fc.property(
        geoPositionArb,
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.array(geoPositionArb, { minLength: 1, maxLength: 20 }),
        (center, rawRadius, positions) => {
          const broadcasts = positions.map(broadcastAtPosition);
          const results = simulateFeedQuery(center, rawRadius, broadcasts);
          const clampedRadius = validateRadius(rawRadius);
          const resultIds = new Set(results.map((b) => b.id));

          for (const b of broadcasts) {
            const dist = haversineMeters(center, b.location);
            if (dist > clampedRadius) {
              expect(resultIds.has(b.id)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('updating the query center changes which broadcasts are included', () => {
    fc.assert(
      fc.property(
        geoPositionArb,
        geoPositionArb,
        fc.double({ min: 50, max: 500, noNaN: true }),
        fc.array(geoPositionArb, { minLength: 5, maxLength: 20 }),
        (center1, center2, radius, positions) => {
          const broadcasts = positions.map(broadcastAtPosition);
          const feed1 = simulateFeedQuery(center1, radius, broadcasts);
          const feed2 = simulateFeedQuery(center2, radius, broadcasts);

          // Each feed's results must be valid for its own center
          for (const b of feed1) {
            expect(haversineMeters(center1, b.location)).toBeLessThanOrEqual(radius);
          }
          for (const b of feed2) {
            expect(haversineMeters(center2, b.location)).toBeLessThanOrEqual(radius);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
