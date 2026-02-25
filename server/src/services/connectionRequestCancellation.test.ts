import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { ConnectionRequest } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 17: Connection request cancellation
 * Validates: Requirements 6.4
 *
 * For any pending connection request, the viewer should be able to cancel it,
 * and after cancellation the request status should be 'cancelled' and the
 * broadcaster should no longer see it as pending.
 */

/**
 * Simulate cancelling a pending connection request.
 * Only pending requests can be cancelled.
 */
function cancelConnectionRequest(request: ConnectionRequest): ConnectionRequest {
  if (request.status !== 'pending') {
    return request;
  }
  return { ...request, status: 'cancelled' };
}

/**
 * Filter visible pending requests for a broadcaster.
 */
function getPendingRequestsForBroadcaster(
  requests: ConnectionRequest[],
  broadcasterUserId: string,
): ConnectionRequest[] {
  return requests.filter(
    (r) => r.broadcasterUserId === broadcasterUserId && r.status === 'pending',
  );
}

describe('Property 17: Connection request cancellation', () => {
  it('cancelling a pending request sets status to cancelled and removes it from broadcaster pending list', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), async (viewerUserId, broadcasterUserId) => {
        const request: ConnectionRequest = {
          id: randomUUID(),
          viewerUserId,
          broadcasterUserId,
          status: 'pending',
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };

        // Before cancellation: request is pending and visible to broadcaster
        const pendingBefore = getPendingRequestsForBroadcaster([request], broadcasterUserId);
        expect(pendingBefore).toHaveLength(1);

        // Cancel the request
        const cancelled = cancelConnectionRequest(request);

        // Status should be 'cancelled'
        expect(cancelled.status).toBe('cancelled');

        // Broadcaster should no longer see it as pending
        const pendingAfter = getPendingRequestsForBroadcaster([cancelled], broadcasterUserId);
        expect(pendingAfter).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it('only pending requests can be cancelled — non-pending requests are unchanged', async () => {
    const nonPendingStatusArb = fc.constantFrom(
      'accepted' as const,
      'declined' as const,
      'expired' as const,
      'cancelled' as const,
    );

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        nonPendingStatusArb,
        async (viewerUserId, broadcasterUserId, status) => {
          const request: ConnectionRequest = {
            id: randomUUID(),
            viewerUserId,
            broadcasterUserId,
            status,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          };

          const result = cancelConnectionRequest(request);

          // Non-pending requests should remain unchanged
          expect(result.status).toBe(status);
        },
      ),
      { numRuns: 100 },
    );
  });
});
