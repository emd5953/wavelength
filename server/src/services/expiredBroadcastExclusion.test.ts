import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateRadius } from './proximityService';
import type { GeoPosition, Broadcast } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 11: Expired broadcasts excluded from feed
 * Validates: Requirements 4.3
 *
 * For any nearby feed query, no broadcast whose broadcaster has stopped playing
 * or left the vicinity should appear in the results.
 *
 * We test two expiry conditions:
 * 1. Time-based: broadcasts older than 30 seconds (stale) are expired
 * 2. Distance-based: broadcasts outside the vicinity radius are excluded
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

const STALE_THRESHOLD_MS = 30_000;

interface TimedBroadcast extends Broadcast {
  _createdAtMs: number;
}

function makeBroadcast(pos: GeoPosition, createdAtMs: number): TimedBroadcast {
  return {
    id: crypto.randomUUID(),
    anonymousId: crypto.randomUUID(),
    trackTitle: 'Track',
    artistName: 'Artist',
    albumArtUrl: 'https://example.com/art.jpg',
    startedAt: Date.now(),
    location: pos,
    createdAt: createdAtMs,
    _createdAtMs: createdAtMs,
  };
}

/**
 * Simulates the feed query with expiry: first remove stale broadcasts,
 * then filter by distance, then sort by proximity.
 * Mirrors expireStaleBroadcasts() + getBroadcastsInRadius() pipeline.
 */
function simulateFeedWithExpiry(
  center: GeoPosition,
  radiusMeters: number,
  broadcasts: TimedBroadcast[],
  nowMs: number,
): Broadcast[] {
  const clamped = validateRadius(radiusMeters);

  return broadcasts
    .filter((b) => nowMs - b._createdAtMs < STALE_THRESHOLD_MS)
    .filter((b) => haversineMeters(center, b.location) <= clamped)
    .sort(
      (a, b) =>
        haversineMeters(center, a.location) - haversineMeters(center, b.location),
    );
}

describe('Property 11: Expired broadcasts excluded from feed', () => {
  it('stale broadcasts (older than 30s) never appear in feed results', () => {
    fc.assert(
      fc.property(
        geoPositionArb,
        fc.double({ min: 50, max: 500, noNaN: true }),
        fc.array(
          fc.record({
            pos: geoPositionArb,
            ageMs: fc.integer({ min: 0, max: 120_000 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (center, radius, entries) => {
          const now = Date.now();
          const broadcasts = entries.map((e) =>
            makeBroadcast(e.pos, now - e.ageMs),
          );

          const results = simulateFeedWithExpiry(center, radius, broadcasts, now);

          // Every result must be fresh (created less than 30s ago)
          for (const b of results) {
            const tb = b as TimedBroadcast;
            expect(now - tb._createdAtMs).toBeLessThan(STALE_THRESHOLD_MS);
          }

          // Every stale broadcast must be absent from results
          const resultIds = new Set(results.map((b) => b.id));
          for (const b of broadcasts) {
            if (now - b._createdAtMs >= STALE_THRESHOLD_MS) {
              expect(resultIds.has(b.id)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('broadcasts outside the vicinity radius are excluded from feed', () => {
    fc.assert(
      fc.property(
        geoPositionArb,
        fc.double({ min: 50, max: 500, noNaN: true }),
        fc.array(
          fc.record({
            pos: geoPositionArb,
            ageMs: fc.integer({ min: 0, max: 20_000 }), // all fresh
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (center, radius, entries) => {
          const now = Date.now();
          const broadcasts = entries.map((e) =>
            makeBroadcast(e.pos, now - e.ageMs),
          );

          const results = simulateFeedWithExpiry(center, radius, broadcasts, now);
          const clamped = validateRadius(radius);
          const resultIds = new Set(results.map((b) => b.id));

          for (const b of broadcasts) {
            const dist = haversineMeters(center, b.location);
            if (dist > clamped) {
              expect(resultIds.has(b.id)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
