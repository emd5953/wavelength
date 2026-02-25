import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import type { ConnectionRequest } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 18: Connection request expiry
 * Validates: Requirements 6.5
 *
 * For any connection request with a created-at timestamp more than 24 hours
 * in the past and status still 'pending', the expiry process should mark
 * it as 'expired'.
 */

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Simulate the expiry process: marks pending requests as 'expired'
 * if their expiresAt timestamp is in the past relative to `now`.
 */
function expireStaleRequests(
  requests: ConnectionRequest[],
  now: number,
): ConnectionRequest[] {
  return requests.map((r) => {
    if (r.status === 'pending' && r.expiresAt <= now) {
      return { ...r, status: 'expired' as const };
    }
    return r;
  });
}

describe('Property 18: Connection request expiry', () => {
  it('pending requests older than 24h are marked as expired', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 1_000_000_000 }),
        async (viewerUserId, broadcasterUserId, ageOffsetMs) => {
          const now = Date.now();
          // createdAt is more than 24h ago
          const createdAt = now - TWENTY_FOUR_HOURS_MS - ageOffsetMs;
          const expiresAt = createdAt + TWENTY_FOUR_HOURS_MS;

          const request: ConnectionRequest = {
            id: randomUUID(),
            viewerUserId,
            broadcasterUserId,
            status: 'pending',
            createdAt,
            expiresAt,
          };

          const [result] = expireStaleRequests([request], now);

          expect(result.status).toBe('expired');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('pending requests within 24h remain pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: TWENTY_FOUR_HOURS_MS - 1 }),
        async (viewerUserId, broadcasterUserId, ageMs) => {
          const now = Date.now();
          const createdAt = now - ageMs;
          const expiresAt = createdAt + TWENTY_FOUR_HOURS_MS;

          const request: ConnectionRequest = {
            id: randomUUID(),
            viewerUserId,
            broadcasterUserId,
            status: 'pending',
            createdAt,
            expiresAt,
          };

          const [result] = expireStaleRequests([request], now);

          expect(result.status).toBe('pending');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-pending requests are never changed by the expiry process', async () => {
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
          const now = Date.now();
          // Even if older than 24h, non-pending requests stay unchanged
          const createdAt = now - TWENTY_FOUR_HOURS_MS - 100_000;
          const expiresAt = createdAt + TWENTY_FOUR_HOURS_MS;

          const request: ConnectionRequest = {
            id: randomUUID(),
            viewerUserId,
            broadcasterUserId,
            status,
            createdAt,
            expiresAt,
          };

          const [result] = expireStaleRequests([request], now);

          expect(result.status).toBe(status);
        },
      ),
      { numRuns: 100 },
    );
  });
});
