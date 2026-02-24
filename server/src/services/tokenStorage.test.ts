import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  storeTokens,
  getStoredTokens,
  clearTokens,
  refreshIfExpired,
  createMemoryStore,
  type SpotifyTokens,
  type RefreshFn,
} from './tokenStorage';

/**
 * Feature: music-vicinity-matchmaker, Property 1: Token storage round-trip
 * Validates: Requirements 1.2
 *
 * For any successful Spotify OAuth flow producing valid tokens,
 * storing the tokens to secure storage and then reading them back
 * should produce equivalent token values.
 */
describe('Property 1: Token storage round-trip', () => {
  const spotifyTokensArb: fc.Arbitrary<SpotifyTokens> = fc.record({
    accessToken: fc.string({ minLength: 1 }),
    refreshToken: fc.string({ minLength: 1 }),
    expiresAt: fc.integer({ min: 0 }),
  });

  it('store then retrieve returns equivalent tokens', async () => {
    await fc.assert(
      fc.asyncProperty(spotifyTokensArb, async (tokens) => {
        const store = createMemoryStore();

        await storeTokens(store, tokens);
        const retrieved = await getStoredTokens(store);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.accessToken).toBe(tokens.accessToken);
        expect(retrieved!.refreshToken).toBe(tokens.refreshToken);
        expect(retrieved!.expiresAt).toBe(tokens.expiresAt);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: music-vicinity-matchmaker, Property 2: Token refresh on expiry
 * Validates: Requirements 1.4
 *
 * For any expired access token paired with a valid refresh token,
 * the auth module should obtain a new valid access token without user
 * interaction, and the new token should have a future expiry time.
 */
describe('Property 2: Token refresh on expiry', () => {
  const spotifyTokensArb: fc.Arbitrary<SpotifyTokens> = fc.record({
    accessToken: fc.string({ minLength: 1 }),
    refreshToken: fc.string({ minLength: 1 }),
    expiresAt: fc.integer({ min: 0 }),
  });

  it('expired tokens trigger refresh and produce a future expiry', async () => {
    await fc.assert(
      fc.asyncProperty(
        spotifyTokensArb,
        fc.string({ minLength: 1 }),   // new access token from refresh
        fc.integer({ min: 1, max: 7200 }), // new lifetime in seconds
        async (original, newAccessToken, lifetimeSec) => {
          const store = createMemoryStore();
          await storeTokens(store, original);

          // "now" is after expiry (past the 60s buffer)
          const now = original.expiresAt + 1;

          const refreshedTokens: SpotifyTokens = {
            accessToken: newAccessToken,
            refreshToken: original.refreshToken,
            expiresAt: now + lifetimeSec * 1000,
          };

          const refreshFn: RefreshFn = async (_rt) => refreshedTokens;

          const result = await refreshIfExpired(store, refreshFn, now);

          expect(result).not.toBeNull();
          expect(result!.accessToken).toBe(newAccessToken);
          expect(result!.expiresAt).toBeGreaterThan(now);

          // Verify new tokens are persisted
          const stored = await getStoredTokens(store);
          expect(stored).not.toBeNull();
          expect(stored!.accessToken).toBe(newAccessToken);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-expired tokens are returned without calling refresh', async () => {
    await fc.assert(
      fc.asyncProperty(spotifyTokensArb, async (original) => {
        const store = createMemoryStore();
        await storeTokens(store, original);

        // "now" is well before expiry (more than 60s buffer)
        const now = original.expiresAt - 120_000;

        let refreshCalled = false;
        const refreshFn: RefreshFn = async () => {
          refreshCalled = true;
          return null;
        };

        const result = await refreshIfExpired(store, refreshFn, now);

        expect(result).not.toBeNull();
        expect(result!.accessToken).toBe(original.accessToken);
        expect(refreshCalled).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('failed refresh clears tokens and returns null', async () => {
    await fc.assert(
      fc.asyncProperty(spotifyTokensArb, async (original) => {
        const store = createMemoryStore();
        await storeTokens(store, original);

        const now = original.expiresAt + 1;
        const refreshFn: RefreshFn = async () => null; // simulate failure

        const result = await refreshIfExpired(store, refreshFn, now);

        expect(result).toBeNull();

        // Tokens should be cleared
        const stored = await getStoredTokens(store);
        expect(stored).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
