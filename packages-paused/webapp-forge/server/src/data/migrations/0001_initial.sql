-- 0001 initial migration -- Phase 1 schema.
-- Mirror of schema.sql; kept as a separate file so future migrations can
-- be applied in numeric order without re-running this one.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,
  email         TEXT,
  password_hash TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS repos (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  visibility      TEXT NOT NULL DEFAULT 'public',
  default_branch  TEXT NOT NULL DEFAULT 'main',
  created_at      INTEGER NOT NULL,
  UNIQUE(owner_id, name)
);

CREATE TABLE IF NOT EXISTS labels (
  id        TEXT PRIMARY KEY,
  repo_id   TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  color     TEXT NOT NULL DEFAULT '888888',
  UNIQUE(repo_id, name)
);

CREATE TABLE IF NOT EXISTS issues (
  id          TEXT PRIMARY KEY,
  repo_id     TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  author_id   TEXT NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  state       TEXT NOT NULL DEFAULT 'open',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE(repo_id, number)
);

CREATE INDEX IF NOT EXISTS issues_repo_state_updated
  ON issues(repo_id, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS issue_labels (
  issue_id  TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id  TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, label_id)
);

CREATE INDEX IF NOT EXISTS issue_labels_label
  ON issue_labels(label_id, issue_id);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS comments_issue_created
  ON comments(issue_id, created_at);

CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  kind            TEXT NOT NULL,
  payload         TEXT NOT NULL DEFAULT '{}',
  sequence_number INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS events_resource
  ON events(resource_type, resource_id, sequence_number);

CREATE TABLE IF NOT EXISTS sequences (
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  current       INTEGER NOT NULL,
  PRIMARY KEY (resource_type, resource_id)
);

-- See schema.sql for the full rationale on `source_event_id` vs
-- `source_event_sequence`. Both currently store `events.id`; the
-- separation lets Phase 2+ telemetry diverge them without changing
-- the sequence-guard semantics.
CREATE TABLE IF NOT EXISTS fragment_index (
  fragment_key            TEXT PRIMARY KEY,
  content_hash            TEXT NOT NULL,
  last_built_at           INTEGER NOT NULL,
  source_event_id         INTEGER NOT NULL,
  source_event_sequence   INTEGER NOT NULL
);
