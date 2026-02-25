-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table (real identity, never exposed in broadcasts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_user_id VARCHAR(255) UNIQUE NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active broadcasts (ephemeral, cleaned up on stop/disconnect)
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  anonymous_id VARCHAR(64) UNIQUE NOT NULL,
  track_title VARCHAR(500) NOT NULL,
  artist_name VARCHAR(500) NOT NULL,
  album_art_url TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_location ON broadcasts USING GIST(location);

-- Reactions
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE CASCADE,
  viewer_anon_id VARCHAR(64) NOT NULL,
  reaction_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broadcast_id, viewer_anon_id, reaction_type)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE CASCADE,
  author_anon_id VARCHAR(64) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Direct messages
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_anon_id VARCHAR(64) NOT NULL,
  recipient_anon_id VARCHAR(64) NOT NULL,
  text TEXT NOT NULL,
  includes_connection_request BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connection requests
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broadcaster_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Connections (mutual, identity revealed)
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id)
);

-- Vicinity settings per user
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vicinity_radius_meters INTEGER NOT NULL DEFAULT 100,
  CHECK (vicinity_radius_meters >= 50 AND vicinity_radius_meters <= 500)
);

-- Add last known location columns to users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_latitude') THEN
    ALTER TABLE users ADD COLUMN last_latitude DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN last_longitude DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN last_location_at TIMESTAMPTZ;
  END IF;
END $$;
