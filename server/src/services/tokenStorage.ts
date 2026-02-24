/**
 * Token storage module — abstracts secure token persistence.
 * Uses a pluggable store interface so it can be backed by
 * expo-secure-store on mobile or any key-value store on server/test.
 */

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface KeyValueStore {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  deleteItem(key: string): Promise<void>;
}

const TOKEN_KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
} as const;

export async function storeTokens(store: KeyValueStore, tokens: SpotifyTokens): Promise<void> {
  await store.setItem(TOKEN_KEYS.accessToken, tokens.accessToken);
  await store.setItem(TOKEN_KEYS.refreshToken, tokens.refreshToken);
  await store.setItem(TOKEN_KEYS.expiresAt, String(tokens.expiresAt));
}

export async function getStoredTokens(store: KeyValueStore): Promise<SpotifyTokens | null> {
  const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
    store.getItem(TOKEN_KEYS.accessToken),
    store.getItem(TOKEN_KEYS.refreshToken),
    store.getItem(TOKEN_KEYS.expiresAt),
  ]);

  if (!accessToken || !refreshToken || !expiresAtStr) return null;

  return { accessToken, refreshToken, expiresAt: Number(expiresAtStr) };
}

export async function clearTokens(store: KeyValueStore): Promise<void> {
  await store.deleteItem(TOKEN_KEYS.accessToken);
  await store.deleteItem(TOKEN_KEYS.refreshToken);
  await store.deleteItem(TOKEN_KEYS.expiresAt);
}

/**
 * Pluggable refresh function signature.
 * Given a refresh token, returns new tokens or null on failure.
 */
export type RefreshFn = (refreshToken: string) => Promise<SpotifyTokens | null>;

/**
 * Check if stored tokens are expired and refresh if needed.
 * Returns valid tokens, or null if refresh fails / no tokens stored.
 * Core logic for Requirement 1.4 — silent token refresh on expiry.
 */
export async function refreshIfExpired(
  store: KeyValueStore,
  refreshFn: RefreshFn,
  now: number = Date.now(),
): Promise<SpotifyTokens | null> {
  const stored = await getStoredTokens(store);
  if (!stored) return null;

  // Still valid (with 60s buffer)
  if (now < stored.expiresAt - 60_000) {
    return stored;
  }

  // Expired — attempt refresh
  const refreshed = await refreshFn(stored.refreshToken);
  if (!refreshed) {
    await clearTokens(store);
    return null;
  }

  await storeTokens(store, refreshed);
  return refreshed;
}

/** Simple in-memory store for testing */
export function createMemoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    async setItem(key, value) { data.set(key, value); },
    async getItem(key) { return data.get(key) ?? null; },
    async deleteItem(key) { data.delete(key); },
  };
}
