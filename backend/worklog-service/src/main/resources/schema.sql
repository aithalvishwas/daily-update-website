CREATE TABLE IF NOT EXISTS work_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    user_name  VARCHAR(100) NOT NULL,
    work_date  DATE NOT NULL,
    tasks      TEXT NOT NULL,
    hours      NUMERIC(4, 1) CHECK (hours >= 0 AND hours <= 24),
    blockers   TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, work_date)
);
CREATE INDEX IF NOT EXISTS work_logs_user_date_idx ON work_logs (user_id, work_date DESC);

ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS epic_id BIGINT;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS epic_name VARCHAR(150);
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS attachment_ids BIGINT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS work_logs_epic_idx ON work_logs (epic_id, work_date DESC);

-- Workspaces: every company's data is kept apart. Rows from before workspaces existed belong to
-- company 1. company_id is filled in automatically from the signed-in user's workspace, and the
-- company_isolation policies hide other companies' rows (see TenantDatabase in common).
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE work_logs SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE work_logs ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE work_logs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON work_logs;
CREATE POLICY company_isolation ON work_logs
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS work_logs_company_idx ON work_logs (company_id);
