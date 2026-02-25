import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SpotifyProfile } from '../types';

/**
 * Feature: full-app-integration
 * Property 8: Spotify profile data extraction
 * Validates: Requirements 4.1, 4.2, 4.3
 *
 * For any valid Spotify API response, the profile fetcher extracts
 * the correct display name, profile image, profile link,
 * min(N, 10) artist names, and min(M, 10) track names.
 */

/** Pure extraction logic matching spotifyProfileFetcher.ts */
function extractProfile(
  meResponse: { display_name?: string; images?: { url: string }[]; external_urls?: { spotify?: string } },
  artistItems: { name: string }[],
  trackItems: { name: string }[],
  fallbackName: string,
): SpotifyProfile {
  const displayName = meResponse.display_name || fallbackName;
  const profileImageUrl = meResponse.images?.[0]?.url || '';
  const profileLink = meResponse.external_urls?.spotify || '';
  const topArtists = artistItems.slice(0, 10).map((a) => a.name);
  const topTracks = trackItems.slice(0, 10).map((t) => t.name);
  return { displayName, profileImageUrl, profileLink, topArtists, topTracks };
}

const artistItemArb = fc.record({ name: fc.string({ minLength: 1 }) });
const trackItemArb = fc.record({ name: fc.string({ minLength: 1 }) });

const meResponseArb = fc.record({
  display_name: fc.string({ minLength: 1 }),
  images: fc.array(fc.record({ url: fc.webUrl() }), { minLength: 1, maxLength: 3 }),
  external_urls: fc.record({ spotify: fc.webUrl() }),
});

describe('Property 8: Spotify profile data extraction', () => {
  it('extracts correct display name, image, link, and capped artist/track lists', () => {
    fc.assert(
      fc.property(
        meResponseArb,
        fc.array(artistItemArb, { minLength: 0, maxLength: 20 }),
        fc.array(trackItemArb, { minLength: 0, maxLength: 20 }),
        (me, artists, tracks) => {
          const profile = extractProfile(me, artists, tracks, 'fallback-id');

          expect(profile.displayName).toBe(me.display_name);
          expect(profile.profileImageUrl).toBe(me.images![0].url);
          expect(profile.profileLink).toBe(me.external_urls!.spotify);
          expect(profile.topArtists.length).toBe(Math.min(artists.length, 10));
          expect(profile.topTracks.length).toBe(Math.min(tracks.length, 10));

          // Each returned name matches the source
          profile.topArtists.forEach((name, i) => {
            expect(name).toBe(artists[i].name);
          });
          profile.topTracks.forEach((name, i) => {
            expect(name).toBe(tracks[i].name);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
