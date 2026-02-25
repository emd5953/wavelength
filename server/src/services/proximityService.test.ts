import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateRadius } from './proximityService';

describe('validateRadius', () => {
  it('clamps values below 50 to 50', () => {
    expect(validateRadius(0)).toBe(50);
    expect(validateRadius(-100)).toBe(50);
    expect(validateRadius(49)).toBe(50);
  });

  it('clamps values above 500 to 500', () => {
    expect(validateRadius(501)).toBe(500);
    expect(validateRadius(9999)).toBe(500);
  });

  it('returns values within range unchanged', () => {
    expect(validateRadius(50)).toBe(50);
    expect(validateRadius(100)).toBe(100);
    expect(validateRadius(250)).toBe(250);
    expect(validateRadius(500)).toBe(500);
  });
});

/**
 * Property 4: Radius validation and clamping
 * Validates: Requirements 2.3
 *
 * For any numeric radius input, validateRadius returns a value
 * clamped to [50, 500]. Below 50 → 50, above 500 → 500, within range → unchanged.
 */
describe('Property 4: Radius validation and clamping', () => {
  it('always returns a value in [50, 500]', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (radius) => {
        const result = validateRadius(radius);
        return result >= 50 && result <= 500;
      }),
      { numRuns: 100 },
    );
  });

  it('returns input unchanged when within [50, 500]', () => {
    fc.assert(
      fc.property(fc.double({ min: 50, max: 500, noNaN: true }), (radius) => {
        return validateRadius(radius) === radius;
      }),
      { numRuns: 100 },
    );
  });

  it('clamps values below 50 to exactly 50', () => {
    fc.assert(
      fc.property(fc.double({ max: 49.999, noNaN: true, noDefaultInfinity: true }), (radius) => {
        return validateRadius(radius) === 50;
      }),
      { numRuns: 100 },
    );
  });

  it('clamps values above 500 to exactly 500', () => {
    fc.assert(
      fc.property(fc.double({ min: 500.001, noNaN: true, noDefaultInfinity: true }), (radius) => {
        return validateRadius(radius) === 500;
      }),
      { numRuns: 100 },
    );
  });
});



/**
 * Property 4: Radius validation and clamping
 * Validates: Requirements 2.3
 *
 * For any numeric radius input, validateRadius returns a value
 * clamped to [50, 500]. Below 50 → 50, above 500 → 500, within range → unchanged.
 */
describe('Property 4: Radius validation and clamping', () => {
  it('always returns a value in [50, 500]', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (radius) => {
        const result = validateRadius(radius);
        return result >= 50 && result <= 500;
      }),
      { numRuns: 100 },
    );
  });

  it('returns input unchanged when within [50, 500]', () => {
    fc.assert(
      fc.property(fc.double({ min: 50, max: 500, noNaN: true }), (radius) => {
        return validateRadius(radius) === radius;
      }),
      { numRuns: 100 },
    );
  });

  it('clamps values below 50 to exactly 50', () => {
    fc.assert(
      fc.property(fc.double({ max: 49.999, noNaN: true, noDefaultInfinity: true }), (radius) => {
        return validateRadius(radius) === 50;
      }),
      { numRuns: 100 },
    );
  });

  it('clamps values above 500 to exactly 500', () => {
    fc.assert(
      fc.property(fc.double({ min: 500.001, noNaN: true, noDefaultInfinity: true }), (radius) => {
        return validateRadius(radius) === 500;
      }),
      { numRuns: 100 },
    );
  });
});
