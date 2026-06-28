-- VPN Platform: initial schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  full_name        VARCHAR(255) NOT NULL DEFAULT '',
  role             VARCHAR(20)  NOT NULL DEFAULT 'customer'
                     CHECK (role IN ('admin', 'customer')),
  status           VARCHAR(20)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'expired', 'suspended')),
  activation_date  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expiration_date  TIMESTAMPTZ  NOT NULL,
  wg_client_id     VARCHAR(255),
  wg_client_ip     VARCHAR(50),
  wg_public_key    TEXT,
  wg_private_key   TEXT,
  wg_preshared_key TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_status    ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_expiry    ON users (expiration_date);
CREATE INDEX IF NOT EXISTS idx_users_wg_client ON users (wg_client_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  details     JSONB,
  ip_address  VARCHAR(50),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_time    ON audit_logs (created_at DESC);

-- Future: servers table for multi-location support
CREATE TABLE IF NOT EXISTS servers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  country     VARCHAR(100) NOT NULL,
  city        VARCHAR(100),
  flag        VARCHAR(10),
  host        VARCHAR(255) NOT NULL,
  port        INTEGER      NOT NULL DEFAULT 51821,
  wg_host     VARCHAR(255) NOT NULL,
  wg_port     INTEGER      NOT NULL DEFAULT 51830,
  status      VARCHAR(20)  NOT NULL DEFAULT 'online'
                CHECK (status IN ('online', 'offline', 'maintenance')),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Future: per-user per-server peer assignments
CREATE TABLE IF NOT EXISTS user_servers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id        UUID        NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  wg_client_id     VARCHAR(255),
  wg_client_ip     VARCHAR(50),
  wg_public_key    TEXT,
  wg_private_key   TEXT,
  wg_preshared_key TEXT,
  is_primary       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, server_id)
);
