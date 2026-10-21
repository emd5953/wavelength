-- Chat between two connected users. Keyed by real user IDs: anonymity ends at
-- connection. Removing the connection deletes its chat.
CREATE TABLE IF NOT EXISTS connection_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connection_messages_thread
  ON connection_messages (connection_id, created_at);
