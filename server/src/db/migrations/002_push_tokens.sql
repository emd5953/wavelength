-- Add push token column to users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'push_token') THEN
    ALTER TABLE users ADD COLUMN push_token TEXT;
  END IF;
END $$;
