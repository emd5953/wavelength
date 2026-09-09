/**
 * Feature: music-taste-matching
 * Unit tests for tasteService — Spotify top-artist/track sync and score computation.
 * Validates: migration 003_music_taste.sql behaviour and feed `tasteScore`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock DB pool ---

const mockQuery = vi.fn();

vi.mock('../db/connection', () => ({
  default: { query: (...args: any[]) => mockQuery(...args) },
  pool: { query: (...args: any[]) => mockQuery(...args) },
}));

// --- Mock global fetch ---

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  mockFetch.mockReset();
});

/** Build a Response-like stub for a Spotify top-items endpoint. */
function spotifyOk(items: unknown[]) {
  return { ok: true, json: async () => ({ items }) } as any;
}

function spotifyFail(status = 401) {
  return { ok: false, status, json: async () => ({}) } as any;
}

/** Queue artist and track responses in the order syncUserTaste issues them. */
function queueTopResponses(artists: any, tracks: any) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('/top/artists')) return artists;
    if (url.includes('/top/tracks')) return tracks;
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const artist = (name: string) => ({ name });
const track = (name: string, artists: string[]) => ({
  id: `id-${name}`,
  name,
  artists: artists.map(artist),
});

/** All INSERT calls made against a given table. */
function insertsInto(table: string) {
  return mockQuery.mock.calls.filter(
    ([sql]) => typeof sql === 'string' && sql.startsWith('INSERT INTO ' + table),
  );
}

// ============================================================
// syncUserTaste
// ============================================================

describe('syncUserTaste', () => {
  it('requests both top-items endpoints with the bearer token', async () => {
    const { syncUserTaste } = await import('./tasteService');
    queueTopResponses(spotifyOk([]), spotifyOk([]));

    await syncUserTaste('user-1', 'token-abc');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    for (const [url, init] of mockFetch.mock.calls) {
      expect(url).toContain('limit=20');
      expect(url).toContain('time_range=medium_term');
      expect(init.headers.Authorization).toBe('Bearer token-abc');
    }
  });

  it('inserts artists with 1-based rank in Spotify order', async () => {
    const { syncUserTaste } = await import('./tasteService');
    queueTopResponses(
      spotifyOk([artist('Radiohead'), artist('Portishead'), artist('Massive Attack')]),
      spotifyOk([]),
    );

    await syncUserTaste('user-1', 'token');

    const inserts = insertsInto('user_top_artists');
    expect(inserts.map(([, params]) => params)).toEqual([
      ['user-1', 'Radiohead', 1],
      ['user-1', 'Portishead', 2],
      ['user-1', 'Massive Attack', 3],
    ]);
  });

  it('inserts tracks with joined artist names and 1-based rank', async () => {
    const { syncUserTaste } = await import('./tasteService');
    queueTopResponses(
      spotifyOk([]),
      spotifyOk([track('Teardrop', ['Massive Attack']), track('Sunday', ['Sonic Youth', 'Cypress Hill'])]),
    );

    await syncUserTaste('user-1', 'token');

    const inserts = insertsInto('user_top_tracks');
    expect(inserts.map(([, params]) => params)).toEqual([
      ['user-1', 'Teardrop', 'Massive Attack', 1],
      ['user-1', 'Sunday', 'Sonic Youth, Cypress Hill', 2],
    ]);
  });

  it('clears stale rows before inserting fresh ones', async () => {
    const { syncUserTaste } = await import('./tasteService');
    queueTopResponses(spotifyOk([artist('Boards of Canada')]), spotifyOk([track('Roygbiv', ['Boards of Canada'])]));

    await syncUserTaste('user-1', 'token');

    const sqls = mockQuery.mock.calls.map(([sql]) => sql as string);
    const artistDelete = sqls.findIndex((s) => s.startsWith('DELETE FROM user_top_artists'));
    const artistInsert = sqls.findIndex((s) => s.startsWith('INSERT INTO user_top_artists'));
    const trackDelete = sqls.findIndex((s) => s.startsWith('DELETE FROM user_top_tracks'));
    const trackInsert = sqls.findIndex((s) => s.startsWith('INSERT INTO user_top_tracks'));

    expect(artistDelete).toBeGreaterThanOrEqual(0);
    expect(artistDelete).toBeLessThan(artistInsert);
    expect(trackDelete).toBeGreaterThanOrEqual(0);
    expect(trackDelete).toBeLessThan(trackInsert);
  });

  it('still syncs tracks when the artists endpoint fails', async () => {
    const { syncUserTaste } = await import('./tasteService');
    queueTopResponses(spotifyFail(), spotifyOk([track('Windowlicker', ['Aphex Twin'])]));

    await syncUserTaste('user-1', 'token');

    expect(insertsInto('user_top_artists')).toHaveLength(0);
    expect(insertsInto('user_top_tracks')).toHaveLength(1);
    // A failed endpoint must not wipe the previous data for that table.
    const sqls = mockQuery.mock.calls.map(([sql]) => sql as string);
    expect(sqls.some((s) => s.startsWith('DELETE FROM user_top_artists'))).toBe(false);
  });

  it('still syncs artists when the tracks endpoint fails', async () => {
    const { syncUserTaste } = await import('./tasteService');
    queueTopResponses(spotifyOk([artist('Aphex Twin')]), spotifyFail(500));

    await syncUserTaste('user-1', 'token');

    expect(insertsInto('user_top_artists')).toHaveLength(1);
    expect(insertsInto('user_top_tracks')).toHaveLength(0);
  });

  it('swallows network errors instead of rejecting', async () => {
    const { syncUserTaste } = await import('./tasteService');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error('network down'));

    await expect(syncUserTaste('user-1', 'token')).resolves.toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
    // The failure is logged with the user it belongs to, not swallowed silently.
    expect(logged.mock.calls[0][0]).toContain('user-1');
    logged.mockRestore();
  });

  it('writes nothing when Spotify returns empty lists', async () => {
    const { syncUserTaste } = await import('./tasteService');
    queueTopResponses(spotifyOk([]), spotifyOk([]));

    await syncUserTaste('user-1', 'token');

    expect(insertsInto('user_top_artists')).toHaveLength(0);
    expect(insertsInto('user_top_tracks')).toHaveLength(0);
  });
});

// ============================================================
// getTasteScore
// ============================================================

describe('getTasteScore', () => {
  /** Stub the two COUNT queries getTasteScore runs, in order. */
  function queueCounts(artists: number, tracks: number) {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('user_top_artists')) return { rows: [{ cnt: String(artists) }] };
      if (sql.includes('user_top_tracks')) return { rows: [{ cnt: String(tracks) }] };
      throw new Error('unexpected query');
    });
  }

  it('scores 0 when nothing is shared', async () => {
    const { getTasteScore } = await import('./tasteService');
    queueCounts(0, 0);
    await expect(getTasteScore('a', 'b')).resolves.toBe(0);
  });

  it('awards 3 points per shared artist', async () => {
    const { getTasteScore } = await import('./tasteService');
    queueCounts(4, 0);
    await expect(getTasteScore('a', 'b')).resolves.toBe(12);
  });

  it('awards 2 points per shared track', async () => {
    const { getTasteScore } = await import('./tasteService');
    queueCounts(0, 7);
    await expect(getTasteScore('a', 'b')).resolves.toBe(14);
  });

  it('sums both components', async () => {
    const { getTasteScore } = await import('./tasteService');
    queueCounts(5, 5);
    await expect(getTasteScore('a', 'b')).resolves.toBe(25);
  });

  it('caps the artist component at 60', async () => {
    const { getTasteScore } = await import('./tasteService');
    queueCounts(100, 0);
    await expect(getTasteScore('a', 'b')).resolves.toBe(60);
  });

  it('caps the track component at 40', async () => {
    const { getTasteScore } = await import('./tasteService');
    queueCounts(0, 100);
    await expect(getTasteScore('a', 'b')).resolves.toBe(40);
  });

  it('never exceeds 100', async () => {
    const { getTasteScore } = await import('./tasteService');
    queueCounts(100, 100);
    await expect(getTasteScore('a', 'b')).resolves.toBe(100);
  });

  it('passes both user ids to each count query', async () => {
    const { getTasteScore } = await import('./tasteService');
    queueCounts(1, 1);

    await getTasteScore('user-a', 'user-b');

    expect(mockQuery.mock.calls).toHaveLength(2);
    for (const [, params] of mockQuery.mock.calls) {
      expect(params).toEqual(['user-a', 'user-b']);
    }
  });

  it('returns 0 rather than throwing when the query fails', async () => {
    const { getTasteScore } = await import('./tasteService');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockRejectedValue(new Error('db down'));

    await expect(getTasteScore('a', 'b')).resolves.toBe(0);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
