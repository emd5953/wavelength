/**
 * Auth Router — Spotify OAuth code exchange and token refresh.
 * Requirements: 1.1, 1.2, 1.3
 */

import { Router, Request, Response } from 'express';
import pool from '../db/connection';

const router = Router();

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_ME_URL = 'https://api.spotify.com/v1/me';

/**
 * POST /auth/callback
 * Exchange Spotify authorization code for tokens, upsert user.
 */
router.post('/callback', async (req: Request, res: Response) => {
  const { code, redirectUri } = req.body;

  if (!code || !redirectUri) {
    res.status(400).json({ error: 'code and redirectUri are required' });
    return;
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.SPOTIFY_CLIENT_ID || '',
        client_secret: process.env.SPOTIFY_CLIENT_SECRET || '',
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      res.status(400).json({ error: `Token exchange failed: ${err}` });
      return;
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Get Spotify user ID
    const meResponse = await fetch(SPOTIFY_ME_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!meResponse.ok) {
      res.status(400).json({ error: 'Failed to fetch Spotify user profile' });
      return;
    }

    const meData = await meResponse.json();
    const spotifyUserId = meData.id;

    // Upsert user
    const upsertQuery = `
      INSERT INTO users (spotify_user_id, encrypted_access_token, encrypted_refresh_token, token_expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (spotify_user_id)
      DO UPDATE SET
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
        token_expires_at = EXCLUDED.token_expires_at
      RETURNING id
    `;

    const result = await pool.query(upsertQuery, [
      spotifyUserId,
      access_token,
      refresh_token,
      expiresAt.toISOString(),
    ]);

    res.json({
      userId: result.rows[0].id,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expiresAt.getTime(),
    });
  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

/**
 * POST /auth/refresh
 * Refresh an expired Spotify access token.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  try {
    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID || '',
        client_secret: process.env.SPOTIFY_CLIENT_SECRET || '',
      }),
    });

    if (!tokenResponse.ok) {
      res.status(401).json({ error: 'Token refresh failed' });
      return;
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Update stored tokens
    await pool.query(
      `UPDATE users SET encrypted_access_token = $1, token_expires_at = $2 WHERE encrypted_refresh_token = $3`,
      [access_token, expiresAt.toISOString(), refreshToken],
    );

    res.json({
      accessToken: access_token,
      expiresAt: expiresAt.getTime(),
    });
  } catch (err) {
    console.error('Auth refresh error:', err);
    res.status(500).json({ error: 'Internal server error during token refresh' });
  }
});

export default router;
