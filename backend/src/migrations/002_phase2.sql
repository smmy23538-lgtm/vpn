-- Phase 2: Multi-server, analytics, connections, devices, notifications, settings

-- ── Countries ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS countries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  code       VARCHAR(10)  NOT NULL UNIQUE,
  flag       VARCHAR(10),
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO countries (name, code, flag, sort_order) VALUES
  ('United States', 'US', '🇺🇸', 1),
  ('United Kingdom', 'GB', '🇬🇧', 2),
  ('Canada',         'CA', '🇨🇦', 3),
  ('Germany',        'DE', '🇩🇪', 4),
  ('France',         'FR', '🇫🇷', 5),
  ('Netherlands',    'NL', '🇳🇱', 6),
  ('Japan',          'JP', '🇯🇵', 7),
  ('Singapore',      'SG', '🇸🇬', 8),
  ('Nigeria',        'NG', '🇳🇬', 9)
ON CONFLICT (code) DO NOTHING;

-- ── Enhance servers table ────────────────────────────────────────────────────
ALTER TABLE servers ADD COLUMN IF NOT EXISTS country_id  UUID REFERENCES countries(id) ON DELETE SET NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS wg_password TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS max_users   INTEGER NOT NULL DEFAULT 100;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS latency_ms  INTEGER;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS description TEXT;

-- Seed the current server
INSERT INTO servers (name, country, city, flag, host, port, wg_host, wg_port, status, is_active)
VALUES ('US East #1', 'United States', 'Ohio', '🇺🇸', '3.21.126.65', 51821, '3.21.126.65', 51830, 'online', TRUE)
ON CONFLICT DO NOTHING;

-- ── Connections (session-level tracking) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES users(id) ON DELETE CASCADE,
  server_id        UUID        REFERENCES servers(id) ON DELETE SET NULL,
  vpn_ip           VARCHAR(50),
  client_ip        VARCHAR(50),
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at  TIMESTAMPTZ,
  duration_seconds INTEGER,
  bytes_rx         BIGINT      NOT NULL DEFAULT 0,
  bytes_tx         BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_connections_user   ON connections (user_id);
CREATE INDEX IF NOT EXISTS idx_connections_server ON connections (server_id);
CREATE INDEX IF NOT EXISTS idx_connections_time   ON connections (connected_at DESC);

-- ── Devices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL DEFAULT 'Unknown Device',
  platform   VARCHAR(50),
  user_agent TEXT,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices (user_id);

-- ── Sessions (JWT tracking for forced logout) ────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti   VARCHAR(100) UNIQUE,
  ip_address  VARCHAR(50),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  revoked     BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti    ON sessions (token_jti);

-- ── Notifications (admin inbox) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  severity   VARCHAR(20)  NOT NULL DEFAULT 'info'
               CHECK (severity IN ('info', 'warning', 'error', 'success')),
  data       JSONB,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_time ON notifications (created_at DESC);

-- ── App settings (key-value) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  label      VARCHAR(255),
  group_name VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings (key, value, label, group_name) VALUES
  ('app_name',              'SecureVPN',           'Application Name',          'general'),
  ('app_logo_url',          '',                    'Logo URL',                  'general'),
  ('support_email',         '',                    'Support Email',             'general'),
  ('default_trial_days',    '0',                   'Default Trial Days',        'subscriptions'),
  ('expiry_warning_days',   '7',                   'Expiry Warning (days)',     'subscriptions'),
  ('max_devices_per_user',  '5',                   'Max Devices per User',      'subscriptions'),
  ('allow_registration',    'false',               'Allow Self-Registration',   'general'),
  ('maintenance_mode',      'false',               'Maintenance Mode',          'general')
ON CONFLICT (key) DO NOTHING;

-- ── Bandwidth snapshots (for analytics charts) ────────────────────────────────
CREATE TABLE IF NOT EXISTS bandwidth_snapshots (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id  UUID        REFERENCES servers(id) ON DELETE CASCADE,
  bytes_rx   BIGINT      NOT NULL DEFAULT 0,
  bytes_tx   BIGINT      NOT NULL DEFAULT 0,
  peer_count INTEGER     NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bw_server_time ON bandwidth_snapshots (server_id, snapshot_at DESC);

-- ── Add server_id and country to users ───────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS server_id  UUID REFERENCES servers(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes      TEXT;
