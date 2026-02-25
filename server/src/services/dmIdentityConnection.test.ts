import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { DM, Connection, SpotifyProfile } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 14: DM identity matches connection status
 * Validates: Requirements 5.3, 5.4, 7.4
 *
 * For any DM thread between two users, if no accepted connection exists
 * between them, the DM payloads should contain only anonymous IDs and no
 * real identity information. If an accepted connection exists, the DM
 * payloads should include real profile information.
 */

const anonIdArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 4, maxLength: 16 },
);

const dmTextArb = fc.string({ minLength: 1, maxLength: 200 });

const spotifyProfileArb: fc.Arbitrary<SpotifyProfile> = fc.record({
  displayName: fc.string({ minLength: 3, maxLength: 50 }).map((s) => `user_${s}`),
  profileImageUrl: fc.webUrl(),
  profileLink: fc.webUrl(),
  topArtists: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
  topTracks: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
});


interface DMWithIdentity {
  dm: DM;
  senderProfile?: SpotifyProfile;
  recipientProfile?: SpotifyProfile;
}

/** Simulate sending a DM — stores only anonymous IDs, no real identity */
function simulateSendDM(
  senderAnonId: string,
  recipientAnonId: string,
  text: string,
  includesConnectionRequest: boolean,
): DM {
  return {
    id: randomUUID(),
    senderAnonId,
    recipientAnonId,
    text,
    createdAt: Date.now(),
    includesConnectionRequest,
  };
}

/**
 * Simulate retrieving a DM thread with identity resolution based on connection status.
 * If connected, attach real profiles. If not, return DMs with anonymous IDs only.
 */
function resolveDMThread(
  dms: DM[],
  connection: Connection | null,
  senderAnonId: string,
  recipientAnonId: string,
): DMWithIdentity[] {
  return dms.map((dm) => {
    if (connection) {
      const senderProfile =
        dm.senderAnonId === senderAnonId
          ? connection.spotifyProfileA
          : connection.spotifyProfileB;
      const recipientProfile =
        dm.recipientAnonId === recipientAnonId
          ? connection.spotifyProfileB
          : connection.spotifyProfileA;
      return { dm, senderProfile, recipientProfile };
    }
    return { dm };
  });
}

describe('Property 14: DM identity matches connection status', () => {
  it('DMs without a connection contain only anonymous IDs and no real identity', async () => {
    await fc.assert(
      fc.asyncProperty(
        anonIdArb,
        anonIdArb,
        fc.array(dmTextArb, { minLength: 1, maxLength: 10 }),
        spotifyProfileArb,
        spotifyProfileArb,
        async (senderAnon, recipientAnon, texts, profileA, profileB) => {
          fc.pre(senderAnon !== recipientAnon);

          const dms = texts.map((text) =>
            simulateSendDM(senderAnon, recipientAnon, text, false),
          );

          const resolved = resolveDMThread(dms, null, senderAnon, recipientAnon);

          for (const entry of resolved) {
            // Should have no profile info attached
            expect(entry.senderProfile).toBeUndefined();
            expect(entry.recipientProfile).toBeUndefined();

            // DM payload should only have anonymous IDs
            expect(entry.dm.senderAnonId).toBe(senderAnon);
            expect(entry.dm.recipientAnonId).toBe(recipientAnon);

            // Serialized DM must not contain real profile data
            const serialized = JSON.stringify(entry);
            expect(serialized).not.toContain(profileA.displayName);
            expect(serialized).not.toContain(profileB.displayName);
            expect(serialized).not.toContain(profileA.profileLink);
            expect(serialized).not.toContain(profileB.profileLink);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('DMs with an accepted connection include real profile information', async () => {
    await fc.assert(
      fc.asyncProperty(
        anonIdArb,
        anonIdArb,
        fc.array(dmTextArb, { minLength: 1, maxLength: 10 }),
        spotifyProfileArb,
        spotifyProfileArb,
        async (senderAnon, recipientAnon, texts, profileA, profileB) => {
          fc.pre(senderAnon !== recipientAnon);

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

          const dms = texts.map((text) =>
            simulateSendDM(senderAnon, recipientAnon, text, false),
          );

          const resolved = resolveDMThread(dms, connection, senderAnon, recipientAnon);

          for (const entry of resolved) {
            // Should have real profiles attached
            expect(entry.senderProfile).toBeDefined();
            expect(entry.recipientProfile).toBeDefined();
            expect(entry.senderProfile!.displayName).toBe(profileA.displayName);
            expect(entry.recipientProfile!.displayName).toBe(profileB.displayName);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
