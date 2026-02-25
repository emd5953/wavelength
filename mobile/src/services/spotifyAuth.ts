import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { SPOTIFY_CONFIG } from '../config/spotify';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
} as const;

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export const SpotifyAuthModule = {
  async login(): Promise<SpotifyTokens | null> {
    const request = new AuthSession.AuthRequest({
      clientId: SPOTIFY_CONFIG.clientId,
      scopes: [...SPOTIFY_CONFIG.scopes],
      redirectUri: SPOTIFY_CONFIG.redirectUri,
      usePKCE: false,
      responseType: AuthSession.ResponseType.Code,
      extraParams: { show_dialog: 'true' },
    });

    const result = await request.promptAsync(SPOTIFY_CONFIG.discovery);

    if (result.type !== 'success' || !result.params.code) {
      console.log('AUTH RESULT:', result.type, result.params);
      return null;
    }

    console.log('GOT AUTH CODE, sending to server...');

    // Send code to our server to exchange for tokens
    const res = await fetch(`${API_BASE}/auth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: result.params.code,
        redirectUri: SPOTIFY_CONFIG.redirectUri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Server auth callback failed:', err);
      return null;
    }

    const data = await res.json();
    const tokens: SpotifyTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    };

    await storeTokens(tokens);
    return tokens;
  },

  async refreshToken(refreshTokenValue?: string): Promise<SpotifyTokens | null> {
    const rt = refreshTokenValue ?? (await SecureStore.getItemAsync(TOKEN_KEYS.refreshToken));
    if (!rt) {
      await clearTokens();
      return null;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });

      if (!res.ok) {
        await clearTokens();
        return null;
      }

      const data = await res.json();
      const stored = await getStoredTokens();
      const tokens: SpotifyTokens = {
        accessToken: data.accessToken,
        refreshToken: stored?.refreshToken ?? rt,
        expiresAt: data.expiresAt,
      };

      await storeTokens(tokens);
      return tokens;
    } catch {
      await clearTokens();
      return null;
    }
  },

  async getValidToken(): Promise<string | null> {
    const stored = await getStoredTokens();
    if (!stored) return null;

    if (Date.now() < stored.expiresAt - 60_000) {
      return stored.accessToken;
    }

    const refreshed = await SpotifyAuthModule.refreshToken(stored.refreshToken);
    return refreshed?.accessToken ?? null;
  },

  async logout(): Promise<void> {
    await clearTokens();
  },

  getStoredTokens,
};

// ── helpers ──────────────────────────────────────────────

async function storeTokens(tokens: SpotifyTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEYS.accessToken, tokens.accessToken);
  await SecureStore.setItemAsync(TOKEN_KEYS.refreshToken, tokens.refreshToken);
  await SecureStore.setItemAsync(TOKEN_KEYS.expiresAt, String(tokens.expiresAt));
}

async function getStoredTokens(): Promise<SpotifyTokens | null> {
  const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEYS.accessToken),
    SecureStore.getItemAsync(TOKEN_KEYS.refreshToken),
    SecureStore.getItemAsync(TOKEN_KEYS.expiresAt),
  ]);

  if (!accessToken || !refreshToken || !expiresAtStr) return null;

  return { accessToken, refreshToken, expiresAt: Number(expiresAtStr) };
}

async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEYS.accessToken);
  await SecureStore.deleteItemAsync(TOKEN_KEYS.refreshToken);
  await SecureStore.deleteItemAsync(TOKEN_KEYS.expiresAt);
}
