-- 0004 destructive cutover -- drops the legacy `users` table and rebuilds
-- every dependent (`repos`, `issues`, `comments`, `issue_labels`,
-- `issue_assignees`, `issue_milestone`, `prs`, `reviews`, `repo_members`,
-- `mention_index`) so that all FKs reference Better Auth's `user(id)`.
--
-- Dev-only: this migration drops user-authored data. The user explicitly
-- authorised it as part of the Better Auth cutover; production deployments
-- (none yet) would need a data-preserving rebuild path.
--
-- This migration is run AT MOST ONCE per database. `data/db.ts` checks for
-- the legacy `users` table before executing this script -- once `users` is
-- gone, subsequent boots skip the destructive section. The CREATE TABLE
-- statements use `IF NOT EXISTS` so re-running this script (e.g. on a
-- fresh `:memory:` database where 0001/0002 already produced the same
-- table names) is also safe.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS mention_index;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS prs;
DROP TABLE IF EXISTS issue_milestone;
DROP TABLE IF EXISTS issue_labels;
DROP TABLE IF EXISTS issue_assignees;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS repo_members;
DROP TABLE IF EXISTS repos;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS repos (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL REFERENCES user(id),
  name            TEXT NOT NULL,
  visibility      TEXT NOT NULL DEFAULT 'public',
  default_branch  TEXT NOT NULL DEFAULT 'main',
  created_at      INTEGER NOT NULL,
  UNIQUE(owner_id, name)
);

CREATE TABLE IF NOT EXISTS issues (
  id          TEXT PRIMARY KEY,
  repo_id     TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  author_id   TEXT NOT NULL REFERENCES user(id),
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
  author_id   TEXT NOT NULL REFERENCES user(id),
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS comments_issue_created
  ON comments(issue_id, created_at);

CREATE TABLE IF NOT EXISTS repo_members (
  repo_id  TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role     TEXT NOT NULL DEFAULT 'reader',
  PRIMARY KEY (repo_id, user_id)
);

CREATE INDEX IF NOT EXISTS repo_members_user
  ON repo_members(user_id, repo_id);

CREATE TABLE IF NOT EXISTS issue_assignees (
  issue_id  TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS prs (
  issue_id   TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  base_ref   TEXT NOT NULL,
  head_ref   TEXT NOT NULL,
  head_sha   TEXT NOT NULL,
  mergeable  TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS prs_head_sha
  ON prs(head_sha, issue_id);

CREATE TABLE IF NOT EXISTS reviews (
  id            TEXT PRIMARY KEY,
  pr_issue_id   TEXT NOT NULL REFERENCES prs(issue_id) ON DELETE CASCADE,
  reviewer_id   TEXT NOT NULL REFERENCES user(id),
  state         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS reviews_pr_created
  ON reviews(pr_issue_id, created_at);

CREATE TABLE IF NOT EXISTS mention_index (
  user_id       TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  fragment_key  TEXT NOT NULL,
  PRIMARY KEY (user_id, fragment_key)
);

CREATE INDEX IF NOT EXISTS mention_index_fragment
  ON mention_index(fragment_key, user_id);

PRAGMA foreign_keys = ON;
