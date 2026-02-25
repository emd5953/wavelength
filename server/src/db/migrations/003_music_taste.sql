-- Store user top artists and tracks for taste matching
CREATE TABLE IF NOT EXISTS user_top_artists (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  artist_name VARCHAR(500) NOT NULL,
  rank INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, artist_name)
);

CREATE TABLE IF NOT EXISTS user_top_tracks (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  track_name VARCHAR(500) NOT NULL,
  artist_name VARCHAR(500) NOT NULL,
  rank INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, track_name, artist_name)
);
