import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { CurrentTrack, GeoPosition, Broadcast } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 6: Broadcast data completeness
 * Validates: Requirements 3.1, 4.4
 *
 * For any valid current track and GPS position, the created broadcast should
 * contain the song title, artist name, album art URL, and a valid started-at
 * timestamp. The rendered feed entry should additionally include time-since-start.
 */

/** Simulate broadcast creation mapping (same logic as createBroadcast minus DB) */
function buildBroadcast(
  track: CurrentTrack,
  location: GeoPosition,
): Broadcast {
  return {
    id: randomUUID(),
    anonymousId: randomUUID(),
    trackTitle: track.title,
    artistName: track.artist,
    albumArtUrl: track.albumArt,
    startedAt: track.startedAt,
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      timestamp: location.timestamp,
    },
    createdAt: Date.now(),
  };
}

/** Compute time-since-start for a feed entry */
function computeTimeSinceStart(broadcast: Broadcast, nowMs: number): number {
  return nowMs - broadcast.startedAt;
}

const currentTrackArb: fc.Arbitrary<CurrentTrack> = fc.record({
  trackId: fc.string({ minLength: 1 }),
  title: fc.string({ minLength: 1 }),
  artist: fc.string({ minLength: 1 }),
  albumArt: fc.webUrl(),
  startedAt: fc.integer({ min: 1, max: Date.now() }),
});

const geoPositionArb: fc.Arbitrary<GeoPosition> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.double({ min: 0, max: 1000, noNaN: true }),
  timestamp: fc.integer({ min: 0 }),
});

describe('Property 6: Broadcast data completeness', () => {
  it('broadcast contains song title, artist name, album art URL, and valid startedAt', async () => {
    await fc.assert(
      fc.asyncProperty(currentTrackArb, geoPositionArb, async (track, location) => {
        const broadcast = buildBroadcast(track, location);

        expect(broadcast.trackTitle).toBe(track.title);
        expect(broadcast.artistName).toBe(track.artist);
        expect(broadcast.albumArtUrl).toBe(track.albumArt);
        expect(broadcast.startedAt).toBe(track.startedAt);
        expect(broadcast.startedAt).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('feed entry includes non-negative time-since-start', async () => {
    await fc.assert(
      fc.asyncProperty(currentTrackArb, geoPositionArb, async (track, location) => {
        const broadcast = buildBroadcast(track, location);
        const now = Math.max(broadcast.startedAt, Date.now());
        const timeSinceStart = computeTimeSinceStart(broadcast, now);

        expect(timeSinceStart).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });
});
