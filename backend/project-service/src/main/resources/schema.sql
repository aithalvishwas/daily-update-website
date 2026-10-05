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

-- Tasks on an epic, shown as a board (To do, In progress, In review, Done).
CREATE TABLE IF NOT EXISTS tasks (
    id              BIGSERIAL PRIMARY KEY,
    epic_id         BIGINT NOT NULL REFERENCES epics (id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assignee_id     BIGINT,
    assignee_name   VARCHAR(100),
    due_date        DATE,
    estimate_hours  NUMERIC(5, 1) CHECK (estimate_hours >= 0 AND estimate_hours <= 999),
    created_by      BIGINT NOT NULL,
    created_by_name VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tasks_epic_idx ON tasks (epic_id, status);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks (assignee_id, status);

CREATE TABLE IF NOT EXISTS task_comments (
    id          BIGSERIAL PRIMARY KEY,
    task_id     BIGINT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    author_id   BIGINT NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id, created_at);

-- Milestones: dated checkpoints inside an epic.
CREATE TABLE IF NOT EXISTS milestones (
    id         BIGSERIAL PRIMARY KEY,
    epic_id    BIGINT NOT NULL REFERENCES epics (id) ON DELETE CASCADE,
    name       VARCHAR(150) NOT NULL,
    due_date   DATE NOT NULL,
    done       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestones_epic_idx ON milestones (epic_id, due_date);

-- Workspaces: every company's data is kept apart. Rows from before workspaces existed belong to
-- company 1. company_id is filled in automatically from the signed-in user's workspace, and the
-- company_isolation policies hide other companies' rows (see TenantDatabase in common).
ALTER TABLE epics ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE epics SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE epics ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE epics ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE epics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON epics;
CREATE POLICY company_isolation ON epics
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS epics_company_idx ON epics (company_id);
ALTER TABLE epic_members ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE epic_members SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE epic_members ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE epic_members ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE epic_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON epic_members;
CREATE POLICY company_isolation ON epic_members
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS epic_members_company_idx ON epic_members (company_id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE issues SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE issues ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE issues ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON issues;
CREATE POLICY company_isolation ON issues
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS issues_company_idx ON issues (company_id);
ALTER TABLE issue_replies ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE issue_replies SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE issue_replies ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE issue_replies ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE issue_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON issue_replies;
CREATE POLICY company_isolation ON issue_replies
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS issue_replies_company_idx ON issue_replies (company_id);
ALTER TABLE weekend_requests ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE weekend_requests SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE weekend_requests ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE weekend_requests ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE weekend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON weekend_requests;
CREATE POLICY company_isolation ON weekend_requests
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS weekend_requests_company_idx ON weekend_requests (company_id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE notifications SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE notifications ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE notifications ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON notifications;
CREATE POLICY company_isolation ON notifications
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS notifications_company_idx ON notifications (company_id);
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE attachments SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE attachments ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE attachments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON attachments;
CREATE POLICY company_isolation ON attachments
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS attachments_company_idx ON attachments (company_id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE tasks SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE tasks ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE tasks ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON tasks;
CREATE POLICY company_isolation ON tasks
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS tasks_company_idx ON tasks (company_id);
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE task_comments SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE task_comments ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE task_comments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON task_comments;
CREATE POLICY company_isolation ON task_comments
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS task_comments_company_idx ON task_comments (company_id);
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS company_id BIGINT;
UPDATE milestones SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE milestones ALTER COLUMN company_id SET DEFAULT CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT);
ALTER TABLE milestones ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON milestones;
CREATE POLICY company_isolation ON milestones
    USING (company_id = CAST(NULLIF(current_setting('app.company_id', true), '') AS BIGINT));
CREATE INDEX IF NOT EXISTS milestones_company_idx ON milestones (company_id);
