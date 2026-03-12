-- Migration: Add user_feedbacks table
-- Stores user feedback submitted via the in-app "联系我们" modal.
-- Replaces the previous MarketSDK (LobeHub GitHub issue) approach with self-hosted storage.

CREATE TYPE feedback_status AS ENUM ('pending', 'read', 'resolved');

CREATE TABLE IF NOT EXISTS user_feedbacks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    user_email  TEXT,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    screenshot_url TEXT,
    client_info JSONB DEFAULT '{}'::jsonb,
    status      feedback_status NOT NULL DEFAULT 'pending',
    admin_note  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_feedbacks_user_id_idx    ON user_feedbacks (user_id);
CREATE INDEX IF NOT EXISTS user_feedbacks_status_idx     ON user_feedbacks (status);
CREATE INDEX IF NOT EXISTS user_feedbacks_created_at_idx ON user_feedbacks (created_at DESC);
