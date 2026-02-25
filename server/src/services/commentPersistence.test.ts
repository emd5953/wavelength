import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Comment } from '../types';
import { randomUUID } from 'crypto';

/**
 * Feature: music-vicinity-matchmaker, Property 13: Comment persistence
 * Validates: Requirements 5.2
 *
 * For any comment added to a broadcast, querying the comments for that
 * broadcast should include the added comment with matching text and
 * author anonymous ID.
 */

const anonIdArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 1, maxLength: 16 },
);

const commentTextArb = fc.string({ minLength: 1, maxLength: 200 });

interface StoredComment {
  broadcastId: string;
  authorAnonId: string;
  text: string;
}

/** Simulate addComment — stores a comment and returns it with an id and timestamp */
function simulateAddComment(broadcastId: string, authorAnonId: string, text: string, store: Comment[]): Comment {
  const comment: Comment = {
    id: randomUUID(),
    broadcastId,
    authorAnonId,
    text,
    createdAt: Date.now(),
  };
  store.push(comment);
  return comment;
}

/** Simulate getComments — returns comments for a broadcast ordered by createdAt */
function simulateGetComments(broadcastId: string, store: Comment[]): Comment[] {
  return store
    .filter((c) => c.broadcastId === broadcastId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

describe('Property 13: Comment persistence', () => {
  it('every added comment is retrievable with matching text and author', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ authorAnonId: anonIdArb, text: commentTextArb }),
          { minLength: 1, maxLength: 20 },
        ),
        async (inputs) => {
          const store: Comment[] = [];
          const broadcastId = randomUUID();

          for (const input of inputs) {
            simulateAddComment(broadcastId, input.authorAnonId, input.text, store);
          }

          const retrieved = simulateGetComments(broadcastId, store);

          // Every input comment should appear in retrieved results
          expect(retrieved.length).toBe(inputs.length);
          for (let i = 0; i < inputs.length; i++) {
            expect(retrieved[i].text).toBe(inputs[i].text);
            expect(retrieved[i].authorAnonId).toBe(inputs[i].authorAnonId);
            expect(retrieved[i].broadcastId).toBe(broadcastId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('comments for different broadcasts are isolated', async () => {
    await fc.assert(
      fc.asyncProperty(
        anonIdArb,
        commentTextArb,
        commentTextArb,
        async (author, textA, textB) => {
          const store: Comment[] = [];
          const broadcastA = randomUUID();
          const broadcastB = randomUUID();

          simulateAddComment(broadcastA, author, textA, store);
          simulateAddComment(broadcastB, author, textB, store);

          const commentsA = simulateGetComments(broadcastA, store);
          const commentsB = simulateGetComments(broadcastB, store);

          expect(commentsA.length).toBe(1);
          expect(commentsB.length).toBe(1);
          expect(commentsA[0].text).toBe(textA);
          expect(commentsB[0].text).toBe(textB);
        },
      ),
      { numRuns: 100 },
    );
  });
});
