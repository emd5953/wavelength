/**
 * Feature: listening-sessions-and-recent-feed
 * Unit tests for how the poller maps Spotify responses onto play transitions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/connection', () => ({ default: { query: vi.fn() } }));

const mockRecordPlayback = vi.fn();
const mockRecordNotPlaying = vi.fn();
vi.mock('./broadcastService', () => ({
  recordPlayback: (...a: any[]) => mockRecordPlayback(...a),
  recordNotPlaying: (...a: any[]) => mockRecordNotPlaying(...a),
}));

vi.mock('./feedSocket', () => ({ emitBroadcastNew: vi.fn(), emitPlaysEnded: vi.fn() }));
vi.mock('./pushService', () => ({ notifyRepeatListeners: vi.fn().mockResolvedValue(0) }));
vi.mock('./tasteService', () => ({
  repeatTracksStale: () => false,
  syncRepeatTracks: vi.fn(),
}));

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  encrypted_access_token: 'token',
  token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  last_latitude: 40.758,
  last_longitude: -73.9855,
  repeat_tracks_synced_at: new Date(),
};

function spotifyReturns(status: number, body?: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body ? JSON.stringify(body) : null, { status })));
}

beforeEach(() => {
  mockRecordPlayback.mockReset();
  mockRecordPlayback.mockResolvedValue({ play: {}, change: 'continued', endedPlayId: null });
  mockRecordNotPlaying.mockReset();
  mockRecordNotPlaying.mockResolvedValue([]);
});

afterEach(() => vi.unstubAllGlobals());

describe('pollUser', () => {
  it('ends playback on 204 (nothing playing)', async () => {
    const { pollUser } = await import('./spotifyPoller');
    spotifyReturns(204);

    await pollUser(USER);

    expect(mockRecordNotPlaying).toHaveBeenCalledWith(USER.id);
  });

  it('ends playback when Spotify reports paused', async () => {
    const { pollUser } = await import('./spotifyPoller');
    spotifyReturns(200, { is_playing: false, item: { id: 't', name: 'T', artists: [] } });

    await pollUser(USER);

    expect(mockRecordNotPlaying).toHaveBeenCalledWith(USER.id);
  });

  it.each([401, 429, 500, 503])('leaves the play untouched on a %i error', async (status) => {
    const { pollUser } = await import('./spotifyPoller');
    spotifyReturns(status);

    await pollUser(USER);

    expect(mockRecordNotPlaying).not.toHaveBeenCalled();
    expect(mockRecordPlayback).not.toHaveBeenCalled();
  });

  it('records playback for a playing track', async () => {
    const { pollUser } = await import('./spotifyPoller');
    spotifyReturns(200, {
      is_playing: true,
      progress_ms: 1000,
      item: { id: 'track-1', name: 'Teardrop', artists: [{ name: 'Massive Attack' }] },
    });

    await pollUser(USER);

    expect(mockRecordPlayback).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ trackId: 'track-1', title: 'Teardrop' }),
      expect.objectContaining({ latitude: USER.last_latitude }),
    );
  });
});
