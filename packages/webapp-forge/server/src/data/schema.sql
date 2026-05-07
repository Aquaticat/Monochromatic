-- Cumulative schema for the webapp-forge stack (Phase 1 + Phase 2).
--
-- Idempotent: every CREATE has IF NOT EXISTS so this DDL is safe to run on every boot.
-- See `migrations/0001_initial.sql` and `migrations/0002_phase2.sql` for the
-- canonical migrations applied at boot.
--
-- Phase 1 covers: users, repos, issues, comments, labels, issue_labels, events,
-- fragment_index, sequences.
-- Phase 2 adds: orgs, repo_members, milestones, issue_assignees, issue_milestone,
-- prs, reviews, mention_index.

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

-- The append-only event log feeding the rebuild pipeline.
-- Insert into `events` happens in the same transaction as the resource write.
-- The dispatcher reads events monotonically by id.
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

-- Per-resource monotonic counter. Incremented in the same transaction
-- as the resource write so the worker can discard out-of-order rebuilds.
CREATE TABLE IF NOT EXISTS sequences (
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  current       INTEGER NOT NULL,
  PRIMARY KEY (resource_type, resource_id)
);

-- Fragment cache index. `fragment_key` is content-addressable
-- (e.g. `issues/{repo_id}/{issue_id}/detail`).
--
-- `source_event_sequence` is the global monotonic value used by the
-- sequence guard. The dispatcher writes `events.id` here because filter
-- list fragments span multiple resources, and a per-resource sequence
-- can lose the race against an older event from a different resource.
--
-- `source_event_id` is currently always equal to `source_event_sequence`
-- (both are `events.id`); the column stays separate so Phase 2+ can
-- attach human-readable telemetry pointers (link to the offending
-- write, etc.) without changing the guard semantics.
CREATE TABLE IF NOT EXISTS fragment_index (
  fragment_key            TEXT PRIMARY KEY,
  content_hash            TEXT NOT NULL,
  last_built_at           INTEGER NOT NULL,
  source_event_id         INTEGER NOT NULL,
  source_event_sequence   INTEGER NOT NULL
);

-- Phase 2 additions follow.

CREATE TABLE IF NOT EXISTS orgs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS repo_members (
  repo_id  TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role     TEXT NOT NULL DEFAULT 'reader',
  PRIMARY KEY (repo_id, user_id)
);

CREATE INDEX IF NOT EXISTS repo_members_user
  ON repo_members(user_id, repo_id);

CREATE TABLE IF NOT EXISTS milestones (
  id        TEXT PRIMARY KEY,
  repo_id   TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  due_at    INTEGER,
  UNIQUE(repo_id, title)
);

CREATE TABLE IF NOT EXISTS issue_assignees (
  issue_id  TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS issue_assignees_user
  ON issue_assignees(user_id, issue_id);

CREATE TABLE IF NOT EXISTS issue_milestone (
  issue_id      TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  milestone_id  TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS issue_milestone_lookup
  ON issue_milestone(milestone_id, issue_id);

-- Pull requests share their identity with issues. `mergeable` is one of
-- 'unknown' | 'clean' | 'conflicts'.
CREATE TABLE IF NOT EXISTS prs (
  issue_id   TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  base_ref   TEXT NOT NULL,
  head_ref   TEXT NOT NULL,
  head_sha   TEXT NOT NULL,
  mergeable  TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS prs_head_sha
  ON prs(head_sha, issue_id);

-- Review state values: 'approved' | 'changes_requested' | 'commented'.
CREATE TABLE IF NOT EXISTS reviews (
  id            TEXT PRIMARY KEY,
  pr_issue_id   TEXT NOT NULL REFERENCES prs(issue_id) ON DELETE CASCADE,
  reviewer_id   TEXT NOT NULL REFERENCES users(id),
  state         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS reviews_pr_created
  ON reviews(pr_issue_id, created_at);

-- Reverse index from a mentioned user to fragments whose rendered HTML
-- carries the mention. Cross-cutting fanout (e.g. `user.renamed`) reads
-- this so the rebuild set is bounded by mentions, not by total fragments.
CREATE TABLE IF NOT EXISTS mention_index (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fragment_key  TEXT NOT NULL,
  PRIMARY KEY (user_id, fragment_key)
);

CREATE INDEX IF NOT EXISTS mention_index_fragment
  ON mention_index(fragment_key, user_id);
