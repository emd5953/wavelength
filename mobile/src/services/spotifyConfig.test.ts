jest.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'wavelength://callback',
}));

import { SPOTIFY_CONFIG } from '../config/spotify';

describe('Spotify configuration', () => {
  it('requests the permissions required by the app', () => {
    expect(SPOTIFY_CONFIG.scopes).toEqual(
      expect.arrayContaining([
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-top-read',
        'user-read-private',
      ]),
    );
  });

  it('uses Spotify endpoints and a bounded polling interval', () => {
    expect(SPOTIFY_CONFIG.discovery.authorizationEndpoint).toBe(
      'https://accounts.spotify.com/authorize',
    );
    expect(SPOTIFY_CONFIG.discovery.tokenEndpoint).toBe(
      'https://accounts.spotify.com/api/token',
    );
    expect(SPOTIFY_CONFIG.pollIntervalMs).toBeGreaterThan(0);
  });
});
