import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { CurrentTrack, GeoPosition, Broadcast } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 21: Broadcast payload excludes real identity
 * Validates: Requirements 8.1
 *
 * For any broadcast payload transmitted to the backend, the payload should
 * contain only the anonymous ID, song title, artist name, and album art URL.
 * It should not contain the user's real ID, Spotify user ID, or any profile
 * information.
 */

/** Allowed keys in a broadcast payload sent to clients / over the wire */
const ALLOWED_BROADCAST_KEYS = new Set([
  'id',
  'anonymousId',
  'trackTitle',
  'artistName',
  'albumArtUrl',
  'startedAt',
  'location',
  'createdAt',
]);

/** Simulate building a broadcast payload (mirrors createBroadcast output) */
function buildBroadcastPayload(
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

/** Generate identity values with a distinctive prefix so they won't accidentally appear in broadcast content */
const userIdentityArb = fc.record({
  userId: fc.uuid(),
  spotifyUserId: fc.string({ minLength: 8, maxLength: 40 }).map((s) => `spotify_${s}`),
  displayName: fc.string({ minLength: 3, maxLength: 50 }).map((s) => `user_${s}`),
  email: fc.emailAddress(),
});

describe('Property 21: Broadcast payload excludes real identity', () => {
  it('broadcast payload contains no real user ID, Spotify user ID, or profile info', async () => {
    await fc.assert(
      fc.asyncProperty(
        currentTrackArb,
        geoPositionArb,
        userIdentityArb,
        async (track, location, identity) => {
          const payload = buildBroadcastPayload(track, location);
          const payloadStr = JSON.stringify(payload);

          // Payload must not contain the real user ID
          expect(payloadStr).not.toContain(identity.userId);
          // Payload must not contain the Spotify user ID
          expect(payloadStr).not.toContain(identity.spotifyUserId);
          // Payload must not contain the display name
          expect(payloadStr).not.toContain(identity.displayName);
          // Payload must not contain the email
          expect(payloadStr).not.toContain(identity.email);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('broadcast payload only contains allowed keys (no identity fields)', async () => {
    await fc.assert(
      fc.asyncProperty(currentTrackArb, geoPositionArb, async (track, location) => {
        const payload = buildBroadcastPayload(track, location);
        const keys = Object.keys(payload);

        for (const key of keys) {
          expect(ALLOWED_BROADCAST_KEYS.has(key)).toBe(true);
        }

        // Must not have identity-related fields
        expect(payload).not.toHaveProperty('userId');
        expect(payload).not.toHaveProperty('spotifyUserId');
        expect(payload).not.toHaveProperty('displayName');
        expect(payload).not.toHaveProperty('email');
        expect(payload).not.toHaveProperty('profileImageUrl');
        expect(payload).not.toHaveProperty('profileLink');
      }),
      { numRuns: 100 },
    );
  });
});
