/**
 * Broadcast decision logic.
 * Determines whether a user should have an active broadcast
 * based on their current track state.
 *
 * Requirement 1.5: If Spotify returns no currently playing track,
 * stop broadcasting until a track is detected again.
 */

import type { CurrentTrack } from '../types';

export interface BroadcastAction {
  type: 'create' | 'remove' | 'none';
  track?: CurrentTrack;
}

/**
 * Given the current track (or null) and whether a broadcast already exists,
 * decide what action to take.
 */
export function decideBroadcastAction(
  currentTrack: CurrentTrack | null,
  hasBroadcast: boolean,
): BroadcastAction {
  if (currentTrack === null) {
    return hasBroadcast ? { type: 'remove' } : { type: 'none' };
  }
  return { type: 'create', track: currentTrack };
}
