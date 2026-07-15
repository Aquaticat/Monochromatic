/**
 * Shared types describing the rows returned by every data-access module.
 *
 * Property names mirror the SQL columns (`snake_case`) so the helpers in
 * `db.ts` can pass the result rows through unchanged.
 */

/**
 * Row representing a registered user.
 */
export type User = {
  readonly id: string;
  readonly login: string;
  readonly email: string | null;
  readonly created_at: number;
};

/**
 * Row representing a repository.
 */
export type Repo = {
  readonly id: string;
  readonly owner_id: string;
  readonly name: string;
  readonly visibility: string;
  readonly default_branch: string;
  readonly created_at: number;
};

/**
 * Row representing a label attached to issues.
 */
export type Label = {
  readonly id: string;
  readonly repo_id: string;
  readonly name: string;
  readonly color: string;
};

/**
 * Row representing an issue.
 */
export type Issue = {
  readonly id: string;
  readonly repo_id: string;
  readonly number: number;
  readonly author_id: string;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly created_at: number;
  readonly updated_at: number;
};

/**
 * Row representing a comment on an issue.
 */
export type Comment = {
  readonly id: string;
  readonly issue_id: string;
  readonly author_id: string;
  readonly body: string;
  readonly created_at: number;
};

/**
 * Row representing an event in the append-only log.
 */
export type EventRow = {
  readonly id: number;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly kind: string;
  readonly payload: string;
  readonly sequence_number: number;
  readonly created_at: number;
};

/**
 * Lightweight `(id, updated_at)` row used by filter list queries.
 */
export type IssueIdRow = {
  readonly id: string;
  readonly updated_at: number;
};

/**
 * Row stored in `fragment_index`.
 */
export type FragmentIndexRow = {
  readonly fragment_key: string;
  readonly content_hash: string;
  readonly last_built_at: number;
  readonly source_event_id: number;
  readonly source_event_sequence: number;
};

/**
 * Resource type discriminant for events and sequences.
 */
export type ResourceType = 'issue' | 'repo' | 'comment' | 'pr' | 'review' | 'user';

/**
 * Event-kind discriminant.
 *
 * Phase 1 covers the issue/comment/label cycle. Phase 2 adds git push,
 * pull-request lifecycle, reviews, assignees, milestones, and user rename
 * (the last drives the mention-index fanout).
 */
export type EventKind =
  | 'comment.created'
  | 'issue.created'
  | 'issue.labeled'
  | 'issue.assigned'
  | 'issue.unassigned'
  | 'issue.milestoned'
  | 'pr.opened'
  | 'pr.merged'
  | 'pr.closed'
  | 'review.submitted'
  | 'push'
  | 'user.renamed';

/**
 * Row representing an organisation.
 */
export type Org = {
  readonly id: string;
  readonly name: string;
  readonly created_at: number;
};

/**
 * Row representing repo membership and role.
 */
export type RepoMember = {
  readonly repo_id: string;
  readonly user_id: string;
  readonly role: string;
};

/**
 * Row representing a milestone.
 */
export type Milestone = {
  readonly id: string;
  readonly repo_id: string;
  readonly title: string;
  readonly due_at: number | null;
};

/**
 * Row representing a pull request (shares identity with `issues.id`).
 */
export type PullRequest = {
  readonly issue_id: string;
  readonly base_ref: string;
  readonly head_ref: string;
  readonly head_sha: string;
  readonly mergeable: string;
};

/**
 * Row representing a PR review.
 */
export type Review = {
  readonly id: string;
  readonly pr_issue_id: string;
  readonly reviewer_id: string;
  readonly state: string;
  readonly body: string;
  readonly created_at: number;
};
