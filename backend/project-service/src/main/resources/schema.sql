CREATE TABLE IF NOT EXISTS epics (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    team        VARCHAR(100),
    start_date  DATE NOT NULL,
    due_date    DATE NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done')),
    progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_by  BIGINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (due_date >= start_date)
);

CREATE TABLE IF NOT EXISTS epic_members (
    epic_id   BIGINT NOT NULL REFERENCES epics (id) ON DELETE CASCADE,
    user_id   BIGINT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (epic_id, user_id)
);
CREATE INDEX IF NOT EXISTS epic_members_user_idx ON epic_members (user_id);

CREATE TABLE IF NOT EXISTS issues (
    id             BIGSERIAL PRIMARY KEY,
    type           VARCHAR(20) NOT NULL CHECK (type IN ('blocker', 'deadline', 'other')),
    title          VARCHAR(200) NOT NULL,
    description    TEXT,
    epic_id        BIGINT REFERENCES epics (id) ON DELETE SET NULL,
    raised_by      BIGINT NOT NULL,
    raised_by_name VARCHAR(100) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    source         VARCHAR(20) NOT NULL DEFAULT 'manual',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS issues_status_idx ON issues (status, created_at DESC);

CREATE TABLE IF NOT EXISTS issue_replies (
    id          BIGSERIAL PRIMARY KEY,
    issue_id    BIGINT NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    author_id   BIGINT NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    author_role VARCHAR(20) NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekend_requests (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    user_name     VARCHAR(100) NOT NULL,
    work_date     DATE NOT NULL,
    hours         NUMERIC(4, 1) NOT NULL CHECK (hours > 0 AND hours <= 24),
    compensation  VARCHAR(20) NOT NULL CHECK (compensation IN ('comp_off', 'paid')),
    reason        TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'alternative', 'cancelled')),
    manager_note  TEXT,
    alternative   TEXT,
    decided_by    VARCHAR(100),
    decided_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, work_date)
);

CREATE TABLE IF NOT EXISTS notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    type       VARCHAR(30) NOT NULL,
    title      VARCHAR(200) NOT NULL,
    body       TEXT,
    link       VARCHAR(200),
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS attachments (
    id           BIGSERIAL PRIMARY KEY,
    owner_type   VARCHAR(20),
    owner_id     BIGINT,
    uploader_id  BIGINT NOT NULL,
    filename     VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes   BIGINT NOT NULL,
    storage_key  VARCHAR(64) NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_owner_idx ON attachments (owner_type, owner_id);
