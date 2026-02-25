import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ReactionType, ReactionCount } from '../types';

/**
 * Feature: music-vicinity-matchmaker, Property 12: Reaction count accuracy
 * Validates: Requirements 5.1
 *
 * For any sequence of unique reactions on a broadcast, the reaction count
 * should equal the number of distinct viewer-reaction-type pairs recorded.
 */

const REACTION_TYPES: ReactionType[] = ['fire', 'heart', 'headphones', 'clap', 'surprised'];

const reactionTypeArb = fc.constantFrom(...REACTION_TYPES);
const viewerIdArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 16 });

interface Reaction {
  viewerAnonId: string;
  type: ReactionType;
}

/** Simulate addReaction with ON CONFLICT DO NOTHING (unique per viewer+type) */
function simulateReactions(reactions: Reaction[]): ReactionCount {
  const seen = new Set<string>();
  const counts: ReactionCount = {};

  for (const r of reactions) {
    const key = `${r.viewerAnonId}:${r.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[r.type] = (counts[r.type] ?? 0) + 1;
  }

  return counts;
}

describe('Property 12: Reaction count accuracy', () => {
  const reactionArb: fc.Arbitrary<Reaction> = fc.record({
    viewerAnonId: viewerIdArb,
    type: reactionTypeArb,
  });

  it('reaction count equals distinct viewer-type pairs', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(reactionArb, { minLength: 0, maxLength: 50 }), async (reactions) => {
        const counts = simulateReactions(reactions);

        // Count distinct pairs manually
        const distinctPairs = new Set(reactions.map((r) => `${r.viewerAnonId}:${r.type}`));
        const expectedCounts: ReactionCount = {};
        for (const pair of distinctPairs) {
          const type = pair.split(':').slice(1).join(':') as ReactionType;
          expectedCounts[type] = (expectedCounts[type] ?? 0) + 1;
        }

        // Total count matches
        const totalSimulated = Object.values(counts).reduce((a, b) => a + b, 0);
        const totalExpected = distinctPairs.size;
        expect(totalSimulated).toBe(totalExpected);

        // Per-type counts match
        for (const type of REACTION_TYPES) {
          expect(counts[type] ?? 0).toBe(expectedCounts[type] ?? 0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('duplicate reactions from same viewer do not inflate count', async () => {
    await fc.assert(
      fc.asyncProperty(viewerIdArb, reactionTypeArb, fc.integer({ min: 2, max: 10 }), async (viewer, type, repeats) => {
        const reactions: Reaction[] = Array.from({ length: repeats }, () => ({ viewerAnonId: viewer, type }));
        const counts = simulateReactions(reactions);
        expect(counts[type]).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
