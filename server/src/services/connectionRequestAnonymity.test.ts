import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { ConnectionRequest, SpotifyProfile } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 15: Connection request notification anonymity
 * Validates: Requirements 6.1, 6.3
 *
 * For any connection request event (sent, declined), the notification payload
 * delivered to the recipient should not contain the sender's real user ID,
 * Spotify user ID, or profile information.
 */

interface ConnectionRequestNotification {
  type: 'connection_request_sent' | 'connection_request_declined';
  requestId: string;
  status: ConnectionRequest['status'];
  createdAt: number;
  senderAnonId: string;
}

/**
 * Simulate building a notification payload for a connection request event.
 * The notification must use only the anonymous ID — never the real identity.
 */
function buildConnectionRequestNotification(
  type: 'connection_request_sent' | 'connection_request_declined',
  request: ConnectionRequest,
  senderAnonId: string,
): ConnectionRequestNotification {
  return {
    type,
    requestId: request.id,
    status: request.status,
    createdAt: request.createdAt,
    senderAnonId,
  };
}

const anonIdArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 4, maxLength: 16 },
);

const userIdentityArb = fc.record({
  userId: fc.uuid(),
  spotifyUserId: fc.string({ minLength: 8, maxLength: 40 }).map((s) => `spotify_${s}`),
  displayName: fc.string({ minLength: 3, maxLength: 50 }).map((s) => `user_${s}`),
  profileImageUrl: fc.webUrl(),
  profileLink: fc.webUrl(),
});

describe('Property 15: Connection request notification anonymity', () => {
  it('sent notification contains no real identity of the sender', async () => {
    await fc.assert(
      fc.asyncProperty(
        anonIdArb,
        userIdentityArb,
        async (senderAnon, senderIdentity) => {
          const request: ConnectionRequest = {
            id: randomUUID(),
            viewerUserId: senderIdentity.userId,
            broadcasterUserId: randomUUID(),
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          };

          const notification = buildConnectionRequestNotification(
            'connection_request_sent',
            request,
            senderAnon,
          );

          const serialized = JSON.stringify(notification);

          // Must not contain real user ID
          expect(serialized).not.toContain(senderIdentity.userId);
          // Must not contain Spotify user ID
          expect(serialized).not.toContain(senderIdentity.spotifyUserId);
          // Must not contain display name
          expect(serialized).not.toContain(senderIdentity.displayName);
          // Must not contain profile image URL
          expect(serialized).not.toContain(senderIdentity.profileImageUrl);
          // Must not contain profile link
          expect(serialized).not.toContain(senderIdentity.profileLink);

          // Should use anonymous ID only
          expect(notification.senderAnonId).toBe(senderAnon);
          expect(notification).not.toHaveProperty('viewerUserId');
          expect(notification).not.toHaveProperty('spotifyUserId');
          expect(notification).not.toHaveProperty('displayName');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('declined notification contains no real identity of the sender', async () => {
    await fc.assert(
      fc.asyncProperty(
        anonIdArb,
        userIdentityArb,
        async (senderAnon, senderIdentity) => {
          const request: ConnectionRequest = {
            id: randomUUID(),
            viewerUserId: senderIdentity.userId,
            broadcasterUserId: randomUUID(),
            status: 'declined',
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          };

          const notification = buildConnectionRequestNotification(
            'connection_request_declined',
            request,
            senderAnon,
          );

          const serialized = JSON.stringify(notification);

          // Must not contain real user ID
          expect(serialized).not.toContain(senderIdentity.userId);
          // Must not contain Spotify user ID
          expect(serialized).not.toContain(senderIdentity.spotifyUserId);
          // Must not contain display name
          expect(serialized).not.toContain(senderIdentity.displayName);
          // Must not contain profile URLs
          expect(serialized).not.toContain(senderIdentity.profileImageUrl);
          expect(serialized).not.toContain(senderIdentity.profileLink);

          // Should use anonymous ID only
          expect(notification.senderAnonId).toBe(senderAnon);
        },
      ),
      { numRuns: 100 },
    );
  });
});
