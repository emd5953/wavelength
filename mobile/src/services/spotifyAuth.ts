import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { SPOTIFY_CONFIG } from '../config/spotify';

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

/**
 * Spotify OAuth PKCE auth module.
 * Handles login, token persistence, silent refresh, and logout.
 */
export const SpotifyAuthModule = {
  /**
   * Kick off the Spotify OAuth PKCE flow.
   * Returns tokens on success, null if the user cancels.
   */
  async login(): Promise<SpotifyTokens | null> {
    const request = new AuthSession.AuthRequest({
      clientId: SPOTIFY_CONFIG.clientId,
      scopes: [...SPOTIFY_CONFIG.scopes],
      redirectUri: SPOTIFY_CONFIG.redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    });

    const result = await request.promptAsync(SPOTIFY_CONFIG.discovery);

    if (result.type !== 'success' || !result.params.code) {
      return null;
    }

    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: SPOTIFY_CONFIG.clientId,
        code: result.params.code,
        redirectUri: SPOTIFY_CONFIG.redirectUri,
        extraParams: { code_verifier: request.codeVerifier! },
      },
      SPOTIFY_CONFIG.discovery,
    );

    const tokens = toSpotifyTokens(tokenResponse);
    await storeTokens(tokens);
    return tokens;
  },

  /**
   * Silently refresh the access token using the stored refresh token.
   * Clears stored tokens and returns null on failure.
   */
  async refreshToken(refreshTokenValue?: string): Promise<SpotifyTokens | null> {
    const rt = refreshTokenValue ?? (await SecureStore.getItemAsync(TOKEN_KEYS.refreshToken));
    if (!rt) {
      await clearTokens();
      return null;
    }

    try {
      const tokenResponse = await AuthSession.refreshAsync(
        {
          clientId: SPOTIFY_CONFIG.clientId,
          refreshToken: rt,
        },
        SPOTIFY_CONFIG.discovery,
      );

      const tokens = toSpotifyTokens(tokenResponse);
      await storeTokens(tokens);
      return tokens;
    } catch {
      await clearTokens();
      return null;
    }
  },

  /**
   * Get a valid access token — refreshes automatically if expired.
   * Returns null when re-auth is needed.
   */
  async getValidToken(): Promise<string | null> {
    const stored = await getStoredTokens();
    if (!stored) return null;

    if (Date.now() < stored.expiresAt - 60_000) {
      return stored.accessToken;
    }

    const refreshed = await SpotifyAuthModule.refreshToken(stored.refreshToken);
    return refreshed?.accessToken ?? null;
  },

  /** Clear all stored tokens and end the session. */
  async logout(): Promise<void> {
    await clearTokens();
  },

  /** Read stored tokens (if any). */
  getStoredTokens,
};

// ── helpers ──────────────────────────────────────────────

function toSpotifyTokens(response: AuthSession.TokenResponse): SpotifyTokens {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? '',
    expiresAt: response.issuedAt
      ? (response.issuedAt + (response.expiresIn ?? 3600)) * 1000
      : Date.now() + (response.expiresIn ?? 3600) * 1000,
  };
}

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
