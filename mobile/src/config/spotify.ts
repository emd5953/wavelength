import * as AuthSession from 'expo-auth-session';

const redirectUri = AuthSession.makeRedirectUri({
  native: 'wavelength://callback',
});
console.log('REDIRECT URI:', redirectUri);

export const SPOTIFY_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID',
  scopes: [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-top-read',
    'user-read-email',
    'user-read-private',
  ],
  redirectUri,
  discovery: {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
  },
  apiBaseUrl: 'https://api.spotify.com/v1',
  pollIntervalMs: 10_000,
} as const;
