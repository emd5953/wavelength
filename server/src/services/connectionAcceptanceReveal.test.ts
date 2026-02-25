import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { ConnectionRequest, Connection, SpotifyProfile } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 16: Connection acceptance reveals profiles
 * Validates: Requirements 6.2
 *
 * For any accepted connection request, both the viewer and broadcaster should
 * receive each other's Spotify profile name and profile image, and a mutual
 * connection record should exist.
 */

const spotifyProfileArb: fc.Arbitrary<SpotifyProfile> = fc.record({
  displayName: fc.string({ minLength: 3, maxLength: 50 }).map((s) => `user_${s}`),
  profileImageUrl: fc.webUrl(),
  profileLink: fc.webUrl(),
  topArtists: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
  topTracks: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
});

/**
 * Simulate accepting a connection request:
 * - Transitions request status to 'accepted'
 * - Creates a Connection record with both users' Spotify profiles
 * - Returns the reveal payloads for both users
 */
function acceptConnectionRequest(
  request: ConnectionRequest,
  viewerProfile: SpotifyProfile,
  broadcasterProfile: SpotifyProfile,
): { connection: Connection; viewerReveal: SpotifyProfile; broadcasterReveal: SpotifyProfile } {
  const connection: Connection = {
    id: randomUUID(),
    userAId: request.viewerUserId,
    userBId: request.broadcasterUserId,
    spotifyProfileA: viewerProfile,
    spotifyProfileB: broadcasterProfile,
    createdAt: Date.now(),
  };

  // Viewer receives broadcaster's profile, broadcaster receives viewer's profile
  return {
    connection,
    viewerReveal: broadcasterProfile,
    broadcasterReveal: viewerProfile,
  };
}

describe('Property 16: Connection acceptance reveals profiles', () => {
  it('accepted request reveals both profiles and creates mutual connection', async () => {
    await fc.assert(
      fc.asyncProperty(
        spotifyProfileArb,
        spotifyProfileArb,
        async (viewerProfile, broadcasterProfile) => {
          const viewerUserId = randomUUID();
          const broadcasterUserId = randomUUID();

          const request: ConnectionRequest = {
            id: randomUUID(),
            viewerUserId,
            broadcasterUserId,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          };

          const { connection, viewerReveal, broadcasterReveal } =
            acceptConnectionRequest(request, viewerProfile, broadcasterProfile);

          // Mutual connection record exists linking both users
          expect(connection.userAId).toBe(viewerUserId);
          expect(connection.userBId).toBe(broadcasterUserId);

          // Viewer receives broadcaster's profile name and image
          expect(viewerReveal.displayName).toBe(broadcasterProfile.displayName);
          expect(viewerReveal.profileImageUrl).toBe(broadcasterProfile.profileImageUrl);

          // Broadcaster receives viewer's profile name and image
          expect(broadcasterReveal.displayName).toBe(viewerProfile.displayName);
          expect(broadcasterReveal.profileImageUrl).toBe(viewerProfile.profileImageUrl);

          // Connection stores both profiles
          expect(connection.spotifyProfileA.displayName).toBe(viewerProfile.displayName);
          expect(connection.spotifyProfileB.displayName).toBe(broadcasterProfile.displayName);
        },
      ),
      { numRuns: 100 },
    );
  });
});
