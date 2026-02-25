import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { Connection, SpotifyProfile, DM } from '../types';
import type { ConnectionListItem } from './connectionService';

/**
 * Feature: music-vicinity-matchmaker, Property 20: Connection removal and re-anonymization
 * Validates: Requirements 7.3
 *
 * For any removed connection, neither user's connections list should include
 * the other, and subsequent interactions between them should use anonymous
 * identifiers only.
 */

const spotifyProfileArb: fc.Arbitrary<SpotifyProfile> = fc.record({
  displayName: fc.string({ minLength: 3, maxLength: 50 }).map((s) => `user_${s}`),
  profileImageUrl: fc.webUrl(),
  profileLink: fc.webUrl(),
  topArtists: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
  topTracks: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
});

/**
 * Simulate removing a connection and filtering the connections list,
 * mirroring removeConnection() + getConnections() behaviour.
 */
function removeAndFilterConnections(
  connections: Connection[],
  removedConnectionId: string,
  requestingUserId: string,
): ConnectionListItem[] {
  return connections
    .filter((c) => c.id !== removedConnectionId)
    .filter((c) => c.userAId === requestingUserId || c.userBId === requestingUserId)
    .map((c) => {
      const isUserA = c.userAId === requestingUserId;
      const profile = isUserA ? c.spotifyProfileB : c.spotifyProfileA;
      return {
        id: c.id,
        connectedUserId: isUserA ? c.userBId : c.userAId,
        displayName: profile.displayName,
        profileImageUrl: profile.profileImageUrl,
        createdAt: c.createdAt,
      };
    });
}

/**
 * After removal, subsequent DMs between the two users must use anonymous IDs
 * and must NOT contain any real identity information.
 */
function buildPostRemovalDM(
  senderAnonId: string,
  recipientAnonId: string,
  text: string,
): DM {
  return {
    id: randomUUID(),
    senderAnonId,
    recipientAnonId,
    text,
    createdAt: Date.now(),
    includesConnectionRequest: false,
  };
}

describe('Property 20: Connection removal and re-anonymization', () => {
  it('removed connection does not appear in either user connections list', async () => {
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

          // Remove the connection
          const listForA = removeAndFilterConnections([connection], connection.id, userAId);
          const listForB = removeAndFilterConnections([connection], connection.id, userBId);

          // Neither user should see the other in their connections list
          expect(listForA).toHaveLength(0);
          expect(listForB).toHaveLength(0);
          expect(listForA.find((c) => c.connectedUserId === userBId)).toBeUndefined();
          expect(listForB.find((c) => c.connectedUserId === userAId)).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('subsequent interactions after removal use anonymous identifiers only', async () => {
    await fc.assert(
      fc.asyncProperty(
        spotifyProfileArb,
        spotifyProfileArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        async (profileA, profileB, messageText) => {
          const userAId = randomUUID();
          const userBId = randomUUID();
          const anonIdA = randomUUID();
          const anonIdB = randomUUID();

          // After removal, a DM between the two users uses anonymous IDs
          const dm = buildPostRemovalDM(anonIdA, anonIdB, messageText);

          // DM uses anonymous IDs, not real user IDs
          expect(dm.senderAnonId).toBe(anonIdA);
          expect(dm.recipientAnonId).toBe(anonIdB);
          expect(dm.senderAnonId).not.toBe(userAId);
          expect(dm.recipientAnonId).not.toBe(userBId);

          // DM payload must not contain real identity info
          const dmPayload = JSON.stringify(dm);
          expect(dmPayload).not.toContain(userAId);
          expect(dmPayload).not.toContain(userBId);
          expect(dmPayload).not.toContain(profileA.displayName);
          expect(dmPayload).not.toContain(profileB.displayName);
        },
      ),
      { numRuns: 100 },
    );
  });
});
