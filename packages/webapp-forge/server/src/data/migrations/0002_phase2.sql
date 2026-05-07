-- 0002 phase2 migration -- adds organisations, repo membership, milestones,
-- issue assignees / milestones, pull requests, reviews, and the mention
-- reverse index used for cross-cutting fragment invalidation.
--
-- Idempotent: every CREATE has IF NOT EXISTS so applying this on a database
-- that already ran 0001 is safe to repeat.

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

-- Pull requests share their identity with issues. `issue_id` is both the
-- primary key and the foreign key into `issues`, mirroring GitHub's data
-- model: a PR IS an issue with extra git metadata.
--
-- `mergeable` is a discriminant TEXT column: 'unknown' (not yet computed),
-- 'clean' (ready to merge), 'conflicts' (rebase or merge needed).
CREATE TABLE IF NOT EXISTS prs (
  issue_id   TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  base_ref   TEXT NOT NULL,
  head_ref   TEXT NOT NULL,
  head_sha   TEXT NOT NULL,
  mergeable  TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS prs_head_sha
  ON prs(head_sha, issue_id);

-- Review state values: 'approved', 'changes_requested', 'commented'.
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

-- Reverse index from a mentioned user to every fragment whose rendered
-- HTML carries that mention. The dispatcher consumes this on
-- `user.renamed` events so the fanout is bounded by fragments-with-mentions
-- rather than fragments-in-the-system.
CREATE TABLE IF NOT EXISTS mention_index (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fragment_key  TEXT NOT NULL,
  PRIMARY KEY (user_id, fragment_key)
);

CREATE INDEX IF NOT EXISTS mention_index_fragment
  ON mention_index(fragment_key, user_id);
