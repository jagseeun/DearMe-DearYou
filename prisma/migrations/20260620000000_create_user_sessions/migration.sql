CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index
    WHERE indrelid = '"user_sessions"'::regclass
      AND indisprimary
  ) THEN
    ALTER TABLE "user_sessions"
      ADD CONSTRAINT "user_sessions_pkey"
      PRIMARY KEY ("sid")
      NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire"
  ON "user_sessions" ("expire");
