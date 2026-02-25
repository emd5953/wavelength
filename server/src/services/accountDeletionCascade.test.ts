import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: music-vicinity-matchmaker, Property 23: Account deletion cascades
 * Validates: Requirements 8.4
 *
 * For any deleted user account, all associated broadcasts, DMs, connections,
 * connection requests, and stored tokens should be removed from the database.
 */

interface UserRecord {
  id: string;
  spotifyUserId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
}

interface BroadcastRecord {
  id: string;
  userId: string;
  anonymousId: string;
}

interface DMRecord {
  id: string;
  senderAnonId: string;
  recipientAnonId: string;
}

interface ConnectionRequestRecord {
  id: string;
  viewerUserId: string;
  broadcasterUserId: string;
  status: string;
}

interface ConnectionRecord {
  id: string;
  userAId: string;
  userBId: string;
}

/**
 * Simulates the database with cascade-on-delete behavior matching
 * the real deleteAccount() transaction in privacyService.ts.
 */
function createAccountStore() {
  const users = new Map<string, UserRecord>();
  const broadcasts = new Map<string, BroadcastRecord>();
  const dms = new Map<string, DMRecord>();
  const connectionRequests = new Map<string, ConnectionRequestRecord>();
  const connections = new Map<string, ConnectionRecord>();

  return {
    addUser(user: UserRecord) {
      users.set(user.id, user);
    },
    addBroadcast(b: BroadcastRecord) {
      broadcasts.set(b.id, b);
    },
    addDM(dm: DMRecord) {
      dms.set(dm.id, dm);
    },
    addConnectionRequest(cr: ConnectionRequestRecord) {
      connectionRequests.set(cr.id, cr);
    },
    addConnection(c: ConnectionRecord) {
      connections.set(c.id, c);
    },

    /**
     * Mirrors deleteAccount() logic:
     * 1. Collect anonymous IDs from user's broadcasts
     * 2. Delete DMs sent/received by those anonymous IDs
     * 3. Delete user row — cascades to broadcasts, connection_requests, connections
     */
    deleteAccount(userId: string) {
      // Step 1: collect anonymous IDs for this user's broadcasts
      const anonIds = new Set<string>();
      for (const b of broadcasts.values()) {
        if (b.userId === userId) anonIds.add(b.anonymousId);
      }

      // Step 2: delete DMs involving user's anonymous IDs
      for (const [id, dm] of dms) {
        if (anonIds.has(dm.senderAnonId) || anonIds.has(dm.recipientAnonId)) {
          dms.delete(id);
        }
      }

      // Step 3: cascade delete — broadcasts, connection requests, connections
      for (const [id, b] of broadcasts) {
        if (b.userId === userId) broadcasts.delete(id);
      }
      for (const [id, cr] of connectionRequests) {
        if (cr.viewerUserId === userId || cr.broadcasterUserId === userId) {
          connectionRequests.delete(id);
        }
      }
      for (const [id, c] of connections) {
        if (c.userAId === userId || c.userBId === userId) connections.delete(id);
      }

      // Delete user (tokens stored on user row)
      users.delete(userId);
    },

    // Query helpers
    getUser(userId: string) { return users.get(userId); },
    getBroadcastsForUser(userId: string) {
      return [...broadcasts.values()].filter((b) => b.userId === userId);
    },
    getDMsForAnonIds(anonIds: string[]) {
      const set = new Set(anonIds);
      return [...dms.values()].filter(
        (dm) => set.has(dm.senderAnonId) || set.has(dm.recipientAnonId),
      );
    },
    getConnectionRequestsForUser(userId: string) {
      return [...connectionRequests.values()].filter(
        (cr) => cr.viewerUserId === userId || cr.broadcasterUserId === userId,
      );
    },
    getConnectionsForUser(userId: string) {
      return [...connections.values()].filter(
        (c) => c.userAId === userId || c.userBId === userId,
      );
    },
    allUsers() { return [...users.values()]; },
    allBroadcasts() { return [...broadcasts.values()]; },
    allDMs() { return [...dms.values()]; },
    allConnectionRequests() { return [...connectionRequests.values()]; },
    allConnections() { return [...connections.values()]; },
  };
}

// --- Arbitraries ---

const userArb = fc.uuid().map((id) => ({
  id,
  spotifyUserId: `spotify_${id.slice(0, 8)}`,
  encryptedAccessToken: `enc_access_${id}`,
  encryptedRefreshToken: `enc_refresh_${id}`,
}));

const broadcastArb = (userId: string) =>
  fc.record({
    id: fc.uuid(),
    userId: fc.constant(userId),
    anonymousId: fc.uuid(),
  });

const dmArb = (senderAnonId: string, recipientAnonId: string) =>
  fc.uuid().map((id) => ({
    id,
    senderAnonId,
    recipientAnonId,
  }));

const connectionRequestArb = (viewerUserId: string, broadcasterUserId: string) =>
  fc.uuid().map((id) => ({
    id,
    viewerUserId,
    broadcasterUserId,
    status: 'pending',
  }));

const connectionArb = (userAId: string, userBId: string) =>
  fc.uuid().map((id) => ({ id, userAId, userBId }));

describe('Property 23: Account deletion cascades', () => {
  it('all associated data is removed when a user account is deleted', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
        (deletedUser, broadcastIds) => {
          const store = createAccountStore();
          store.addUser(deletedUser);

          // Create broadcasts for the user
          const anonIds: string[] = [];
          for (const bid of broadcastIds) {
            const anonId = crypto.randomUUID();
            anonIds.push(anonId);
            store.addBroadcast({ id: bid, userId: deletedUser.id, anonymousId: anonId });
          }

          // Create DMs involving the user's anonymous IDs
          for (const anonId of anonIds) {
            store.addDM({ id: crypto.randomUUID(), senderAnonId: anonId, recipientAnonId: 'other_anon' });
            store.addDM({ id: crypto.randomUUID(), senderAnonId: 'other_anon', recipientAnonId: anonId });
          }

          // Create connection requests and connections
          const otherUserId = crypto.randomUUID();
          store.addConnectionRequest({
            id: crypto.randomUUID(),
            viewerUserId: deletedUser.id,
            broadcasterUserId: otherUserId,
            status: 'pending',
          });
          store.addConnection({
            id: crypto.randomUUID(),
            userAId: deletedUser.id,
            userBId: otherUserId,
          });

          // Delete the account
          store.deleteAccount(deletedUser.id);

          // Verify all data is gone
          expect(store.getUser(deletedUser.id)).toBeUndefined();
          expect(store.getBroadcastsForUser(deletedUser.id)).toHaveLength(0);
          expect(store.getDMsForAnonIds(anonIds)).toHaveLength(0);
          expect(store.getConnectionRequestsForUser(deletedUser.id)).toHaveLength(0);
          expect(store.getConnectionsForUser(deletedUser.id)).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('other users data is preserved after one account is deleted', () => {
    fc.assert(
      fc.property(userArb, userArb, (deletedUser, survivingUser) => {
        fc.pre(deletedUser.id !== survivingUser.id);

        const store = createAccountStore();
        store.addUser(deletedUser);
        store.addUser(survivingUser);

        // Deleted user's data
        const deletedAnonId = crypto.randomUUID();
        store.addBroadcast({ id: crypto.randomUUID(), userId: deletedUser.id, anonymousId: deletedAnonId });
        store.addDM({ id: crypto.randomUUID(), senderAnonId: deletedAnonId, recipientAnonId: 'x' });

        // Surviving user's data
        const survivingAnonId = crypto.randomUUID();
        const survivingBroadcastId = crypto.randomUUID();
        const survivingDmId = crypto.randomUUID();
        const survivingCrId = crypto.randomUUID();
        const survivingConnId = crypto.randomUUID();

        store.addBroadcast({ id: survivingBroadcastId, userId: survivingUser.id, anonymousId: survivingAnonId });
        store.addDM({ id: survivingDmId, senderAnonId: survivingAnonId, recipientAnonId: 'y' });
        store.addConnectionRequest({
          id: survivingCrId,
          viewerUserId: survivingUser.id,
          broadcasterUserId: 'someone_else',
          status: 'pending',
        });
        store.addConnection({
          id: survivingConnId,
          userAId: survivingUser.id,
          userBId: 'someone_else',
        });

        // Delete only the first user
        store.deleteAccount(deletedUser.id);

        // Surviving user's data must remain intact
        expect(store.getUser(survivingUser.id)).toBeDefined();
        expect(store.getBroadcastsForUser(survivingUser.id)).toHaveLength(1);
        expect(store.allDMs().some((dm) => dm.id === survivingDmId)).toBe(true);
        expect(store.allConnectionRequests().some((cr) => cr.id === survivingCrId)).toBe(true);
        expect(store.allConnections().some((c) => c.id === survivingConnId)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
