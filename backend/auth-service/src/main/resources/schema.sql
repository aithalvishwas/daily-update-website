CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'manager')),
    team          VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100);
CREATE TABLE IF NOT EXISTS teams (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'manager', 'admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS office VARCHAR(40);
-- Added by an admin and hasn't chosen a password yet.
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_pending BOOLEAN NOT NULL DEFAULT false;
-- Workplace switches the admin can flip, such as weekend_requests.
CREATE TABLE IF NOT EXISTS app_settings (
    key   VARCHAR(60) PRIMARY KEY,
    value TEXT NOT NULL
);
-- Office holidays. A NULL city means every office.
CREATE TABLE IF NOT EXISTS holidays (
    id   BIGSERIAL PRIMARY KEY,
    city VARCHAR(40),
    day  DATE NOT NULL,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
    id         BIGSERIAL PRIMARY KEY,
    slug       VARCHAR(40) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS org_size VARCHAR(20);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- Workspaces: every company's data is kept apart. Rows from before workspaces existed belong to
-- company 1. company_id is filled in automatically from the signed-in user's workspace, and the
-- company_isolation policies hide other companies' rows (see TenantDatabase in common).
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE users SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE users ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON users;
CREATE POLICY company_isolation ON users
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS users_company_idx ON users (company_id);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE teams SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE teams ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE teams ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON teams;
CREATE POLICY company_isolation ON teams
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS teams_company_idx ON teams (company_id);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE app_settings SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE app_settings ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE app_settings ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON app_settings;
CREATE POLICY company_isolation ON app_settings
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS app_settings_company_idx ON app_settings (company_id);
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE holidays SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE holidays ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE holidays ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON holidays;
CREATE POLICY company_isolation ON holidays
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS holidays_company_idx ON holidays (company_id);

-- Emails, team names, settings and holidays are unique inside one workspace, not across all.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_company_email ON users (company_id, email);
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS teams_company_name ON teams (company_id, name);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_company_key ON app_settings (company_id, key);
DROP INDEX IF EXISTS holidays_city_day;
CREATE UNIQUE INDEX IF NOT EXISTS holidays_company_city_day ON holidays (company_id, COALESCE(city, ''), day);

-- One-time links that let someone choose their password (invites and resets). Only a hash of the
-- token is stored.
CREATE TABLE IF NOT EXISTS password_links (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id),
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    company_id BIGINT NOT NULL DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT)
);
ALTER TABLE password_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON password_links;
CREATE POLICY company_isolation ON password_links
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS password_links_user_idx ON password_links (user_id);
