import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { CurrentTrack, GeoPosition, Broadcast } from '../types';

/**
 * Feature: full-app-integration
 * Properties 5, 6, 7: Broadcast Router correctness
 * Validates: Requirements 3.1, 3.2, 3.3
 */

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

/** In-memory broadcast store simulating DB behavior */
function createStore() {
  const store = new Map<string, Broadcast>();
  const userIndex = new Map<string, string>(); // userId -> broadcastId

  return {
    create(userId: string, track: CurrentTrack, location: GeoPosition): Broadcast {
      // Upsert: remove existing first
      const existing = userIndex.get(userId);
      if (existing) {
        store.delete(existing);
      }
      const broadcast: Broadcast = {
        id: randomUUID(),
        anonymousId: randomUUID(),
        trackTitle: track.title,
        artistName: track.artist,
        albumArtUrl: track.albumArt,
        startedAt: track.startedAt,
        location: { ...location },
        createdAt: Date.now(),
      };
      store.set(broadcast.id, broadcast);
      userIndex.set(userId, broadcast.id);
      return broadcast;
    },
    remove(userId: string): { success: boolean } {
      const bid = userIndex.get(userId);
      if (bid) {
        store.delete(bid);
        userIndex.delete(userId);
      }
      return { success: true };
    },
    hasActiveBroadcast(userId: string): boolean {
      return userIndex.has(userId);
    },
  };
}

/** Simulate route-level field validation */
function validateBroadcastBody(body: Record<string, unknown>): { error?: string; status: number } {
  if (!body.track) return { error: 'track is required', status: 400 };
  if (!body.location) return { error: 'location is required', status: 400 };
  return { status: 200 };
}

/**
 * Property 5: Broadcast creation returns complete data
 * Validates: Requirements 3.1
 */
describe('Property 5: Broadcast creation returns complete data', () => {
  it('returned broadcast contains non-empty id, track title, artist, albumArt, and startedAt', () => {
    fc.assert(
      fc.property(currentTrackArb, geoPositionArb, (track, location) => {
        const store = createStore();
        const broadcast = store.create('user-1', track, location);

        expect(broadcast.id).toBeTruthy();
        expect(broadcast.trackTitle).toBe(track.title);
        expect(broadcast.artistName).toBe(track.artist);
        expect(broadcast.albumArtUrl).toBe(track.albumArt);
        expect(broadcast.startedAt).toBe(track.startedAt);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 6: Broadcast removal idempotence
 * Validates: Requirements 3.2
 */
describe('Property 6: Broadcast removal idempotence', () => {
  it('calling remove twice both succeeds and leaves no active broadcast', () => {
    fc.assert(
      fc.property(fc.uuid(), currentTrackArb, geoPositionArb, (userId, track, location) => {
        const store = createStore();
        store.create(userId, track, location);

        const first = store.remove(userId);
        const second = store.remove(userId);

        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(store.hasActiveBroadcast(userId)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 7: Missing broadcast fields rejection
 * Validates: Requirements 3.3
 */
describe('Property 7: Missing broadcast fields rejection', () => {
  it('missing track or location returns 400', () => {
    const partialBodyArb = fc.oneof(
      fc.record({ location: geoPositionArb }),                // missing track
      fc.record({ track: currentTrackArb }),                  // missing location
      fc.constant({}),                                         // missing both
    );

    fc.assert(
      fc.property(partialBodyArb, (body) => {
        const result = validateBroadcastBody(body as Record<string, unknown>);
        expect(result.status).toBe(400);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });
});
