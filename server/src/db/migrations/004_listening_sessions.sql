-- Listening sessions: one anonymous id per session, plays kept for 6h.
-- Every migration re-runs on boot, so each statement must be idempotent.

CREATE TABLE IF NOT EXISTS listening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anonymous_id VARCHAR(64) UNIQUE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_playing_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- At most one open session per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_listening_sessions_open
  ON listening_sessions (user_id) WHERE ended_at IS NULL;

-- Broadcasts become plays: anonymous id moves to the session, plays gain a
-- live/ended lifecycle. Existing rows live at most 30s, so drop them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'broadcasts' AND column_name = 'session_id') THEN
    TRUNCATE broadcasts CASCADE;
    ALTER TABLE broadcasts ADD COLUMN session_id UUID NOT NULL REFERENCES listening_sessions(id) ON DELETE CASCADE;
    ALTER TABLE broadcasts ADD COLUMN track_id VARCHAR(64) NOT NULL;
    ALTER TABLE broadcasts ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE broadcasts ADD COLUMN ended_at TIMESTAMPTZ;
    ALTER TABLE broadcasts DROP COLUMN anonymous_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_broadcasts_session ON broadcasts (session_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_ended_at ON broadcasts (ended_at);

-- Presence heartbeat: the "on the app" half of the session-end rule
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_app_seen_at') THEN
    ALTER TABLE users ADD COLUMN last_app_seen_at TIMESTAMPTZ;
  END IF;
END $$;

-- Spotify short_term top tracks, used for on-repeat push. The sync time lives
-- on users so a user with no recent top tracks still counts as synced.
CREATE TABLE IF NOT EXISTS user_repeat_tracks (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  track_id VARCHAR(64) NOT NULL,
  rank INTEGER NOT NULL,
  PRIMARY KEY (user_id, track_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'repeat_tracks_synced_at') THEN
    ALTER TABLE users ADD COLUMN repeat_tracks_synced_at TIMESTAMPTZ;
  END IF;
END $$;

-- One on-repeat push per (recipient, listener, track), ever
CREATE TABLE IF NOT EXISTS push_notifications_sent (
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listener_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  track_id VARCHAR(64) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (recipient_user_id, listener_user_id, track_id)
);
