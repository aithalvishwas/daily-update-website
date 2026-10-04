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
INSERT INTO teams (name)
    SELECT DISTINCT team FROM users WHERE team IS NOT NULL
    ON CONFLICT (name) DO NOTHING;
ALTER TABLE users ADD COLUMN IF NOT EXISTS office VARCHAR(40);
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
CREATE UNIQUE INDEX IF NOT EXISTS holidays_city_day ON holidays (COALESCE(city, ''), day);
