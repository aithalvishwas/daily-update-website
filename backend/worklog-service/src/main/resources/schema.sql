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
