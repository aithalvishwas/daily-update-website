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
