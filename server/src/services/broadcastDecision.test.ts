import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { decideBroadcastAction } from './broadcastDecision';
import type { CurrentTrack } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 3: No track means no broadcast
 * Validates: Requirements 1.5
 *
 * For any user state where the Spotify API returns no currently playing track,
 * the broadcast service should either not create a broadcast or remove an
 * existing one for that user.
 */
describe('Property 3: No track means no broadcast', () => {
  const currentTrackArb: fc.Arbitrary<CurrentTrack> = fc.record({
    trackId: fc.string({ minLength: 1 }),
    title: fc.string({ minLength: 1 }),
    artist: fc.string({ minLength: 1 }),
    albumArt: fc.webUrl(),
    startedAt: fc.integer({ min: 0 }),
  });

  it('null track never produces a create action', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (hasBroadcast) => {
        const action = decideBroadcastAction(null, hasBroadcast);
        expect(action.type).not.toBe('create');
        expect(action.track).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('null track with existing broadcast produces remove', async () => {
    const action = decideBroadcastAction(null, true);
    expect(action.type).toBe('remove');
  });

  it('null track without existing broadcast produces none', async () => {
    const action = decideBroadcastAction(null, false);
    expect(action.type).toBe('none');
  });

  it('valid track always produces a create action with the track', async () => {
    await fc.assert(
      fc.asyncProperty(currentTrackArb, fc.boolean(), async (track, hasBroadcast) => {
        const action = decideBroadcastAction(track, hasBroadcast);
        expect(action.type).toBe('create');
        expect(action.track).toEqual(track);
      }),
      { numRuns: 100 },
    );
  });
});
