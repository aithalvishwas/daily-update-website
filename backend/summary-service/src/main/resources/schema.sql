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
