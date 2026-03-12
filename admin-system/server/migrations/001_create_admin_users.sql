-- Migration: 001_create_admin_users
-- Description: Create the admin_users table for the admin system's own authentication
-- This table is independent of the main project's users table

CREATE TABLE IF NOT EXISTS admin_users (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT        UNIQUE NOT NULL,
  email       TEXT        UNIQUE NOT NULL,
  password_hash TEXT      NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'admin',   -- 'admin' | 'super_admin'
  permissions JSONB       NOT NULL DEFAULT '[]',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  auth_method TEXT        DEFAULT 'local',
  last_login_at TIMESTAMP,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email    ON admin_users(email);

-- 初始管理员账号由 `pnpm init-db` 脚本创建，不在此处 seed，避免默认密码进入 git 历史
