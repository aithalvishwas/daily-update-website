CREATE TABLE IF NOT EXISTS summaries (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL,
    period_from  DATE NOT NULL,
    period_to    DATE NOT NULL,
    log_count    INTEGER NOT NULL,
    summary      TEXT NOT NULL,
    source       VARCHAR(20) NOT NULL,
    model        VARCHAR(100),
    generated_by BIGINT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS summaries_user_created_idx ON summaries (user_id, created_at DESC);

-- Workspaces: every company's data is kept apart. Rows from before workspaces existed belong to
-- company 1. company_id is filled in automatically from the signed-in user's workspace, and the
-- company_isolation policies hide other companies' rows (see TenantDatabase in common).
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE summaries SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE summaries ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE summaries ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON summaries;
CREATE POLICY company_isolation ON summaries
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS summaries_company_idx ON summaries (company_id);
