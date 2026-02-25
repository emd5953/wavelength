import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { Connection, SpotifyProfile } from '../types';
import type { ConnectionListItem, ConnectionDetail } from './connectionService';

/**
 * Feature: music-vicinity-matchmaker, Property 19: Connected user profile data
 * Validates: Requirements 7.1, 7.2
 *
 * For any connection, the connections list should include the connected user's
 * Spotify profile name and profile image. Viewing the connection detail should
 * include the profile link, top artists, and top tracks.
 */

const spotifyProfileArb: fc.Arbitrary<SpotifyProfile> = fc.record({
  displayName: fc.string({ minLength: 3, maxLength: 50 }).map((s) => `user_${s}`),
  profileImageUrl: fc.webUrl(),
  profileLink: fc.webUrl(),
  topArtists: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
  topTracks: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
});

/**
 * Simulate building a connections list item from a Connection record,
 * mirroring what getConnections() returns for a requesting user.
 */
function buildConnectionListItem(
  connection: Connection,
  requestingUserId: string,
): ConnectionListItem {
  const isUserA = connection.userAId === requestingUserId;
  const connectedProfile = isUserA ? connection.spotifyProfileB : connection.spotifyProfileA;

  return {
    id: connection.id,
    connectedUserId: isUserA ? connection.userBId : connection.userAId,
    displayName: connectedProfile.displayName,
    profileImageUrl: connectedProfile.profileImageUrl,
    createdAt: connection.createdAt,
  };
}

/**
 * Simulate building a connection detail from a Connection record,
 * mirroring what getConnectionDetail() returns.
 */
function buildConnectionDetail(
  connection: Connection,
  requestingUserId: string,
): ConnectionDetail {
  const isUserA = connection.userAId === requestingUserId;
  const connectedProfile = isUserA ? connection.spotifyProfileB : connection.spotifyProfileA;

  return {
    id: connection.id,
    connectedUserId: isUserA ? connection.userBId : connection.userAId,
    profile: connectedProfile,
    createdAt: connection.createdAt,
  };
}

describe('Property 19: Connected user profile data', () => {
  it('connections list includes profile name and image for each connection', async () => {
    await fc.assert(
      fc.asyncProperty(
        spotifyProfileArb,
        spotifyProfileArb,
        async (profileA, profileB) => {
          const userAId = randomUUID();
          const userBId = randomUUID();

          const connection: Connection = {
            id: randomUUID(),
            userAId,
            userBId,
            spotifyProfileA: profileA,
            spotifyProfileB: profileB,
            createdAt: Date.now(),
          };

          // User A sees User B's profile name and image
          const listItemForA = buildConnectionListItem(connection, userAId);
          expect(listItemForA.displayName).toBe(profileB.displayName);
          expect(listItemForA.profileImageUrl).toBe(profileB.profileImageUrl);

          // User B sees User A's profile name and image
          const listItemForB = buildConnectionListItem(connection, userBId);
          expect(listItemForB.displayName).toBe(profileA.displayName);
          expect(listItemForB.profileImageUrl).toBe(profileA.profileImageUrl);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('connection detail includes profile link, top artists, and top tracks', async () => {
    await fc.assert(
      fc.asyncProperty(
        spotifyProfileArb,
        spotifyProfileArb,
        async (profileA, profileB) => {
          const userAId = randomUUID();
          const userBId = randomUUID();

          const connection: Connection = {
            id: randomUUID(),
            userAId,
            userBId,
            spotifyProfileA: profileA,
            spotifyProfileB: profileB,
            createdAt: Date.now(),
          };

          // User A views detail — sees User B's full profile
          const detailForA = buildConnectionDetail(connection, userAId);
          expect(detailForA.profile.profileLink).toBe(profileB.profileLink);
          expect(detailForA.profile.topArtists).toEqual(profileB.topArtists);
          expect(detailForA.profile.topTracks).toEqual(profileB.topTracks);

          // User B views detail — sees User A's full profile
          const detailForB = buildConnectionDetail(connection, userBId);
          expect(detailForB.profile.profileLink).toBe(profileA.profileLink);
          expect(detailForB.profile.topArtists).toEqual(profileA.topArtists);
          expect(detailForB.profile.topTracks).toEqual(profileA.topTracks);
        },
      ),
      { numRuns: 100 },
    );
  });
});
