const MIN_RADIUS = 50;
const MAX_RADIUS = 500;

/**
 * ProximityService — spatial queries and radius validation.
 * Requirements: 2.2, 2.3
 */

/**
 * Clamp a radius value to [50, 500] meters.
 * Any value below 50 returns 50, above 500 returns 500.
 */
export function validateRadius(radiusMeters: number): number {
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radiusMeters));
}
