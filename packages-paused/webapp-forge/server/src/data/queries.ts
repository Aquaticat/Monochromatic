/**
 * Barrel re-export for every data-access helper.
 *
 * Modules are split by concern so each stays under the max-lines budget.
 * Phase 1 modules: events, fragment-index, issue+comment, user/repo.
 * Phase 2 additions: org, membership (repo_members + assignees),
 * milestone, pr, review, mention.
 */

export type {
  Comment,
  EventKind,
  EventRow,
  FragmentIndexRow,
  Issue,
  IssueIdRow,
  Label,
  Milestone,
  Org,
  PullRequest,
  Repo,
  RepoMember,
  ResourceType,
  Review,
  User,
} from './queries/types.ts';

export {
  insertEvent,
  listEventsAfter,
  nextSequence,
} from './queries/event-log.ts';

export {
  getFragmentIndex,
  upsertFragmentIndexIfNewer,
} from './queries/fragment-index.ts';

export {
  createCommentWithEvent,
  createIssueWithEvent,
  getComment,
  getIssue,
  getIssueByNumber,
  labelIssueWithEvent,
  listComments,
  listIssueIdsForFilter,
  listIssueLabels,
} from './queries/issue.ts';

export {
  getLabel,
  getRepo,
  getRepoByOwnerLogin,
  getUser,
  getUserByLogin,
  insertLabel,
  insertRepo,
  insertUser,
  listRepoLabels,
} from './queries/user-repo.ts';

export {
  getOrg,
  getOrgByName,
  insertOrg,
} from './queries/org.ts';

export {
  assignUserToIssue,
  getRepoMember,
  listIssueAssignees,
  listRepoMembers,
  removeRepoMember,
  unassignUserFromIssue,
  upsertRepoMember,
} from './queries/membership.ts';

export {
  clearIssueMilestone,
  getIssueMilestoneId,
  getMilestone,
  insertMilestone,
  listRepoMilestones,
  setIssueMilestone,
} from './queries/milestone.ts';

export {
  createPullRequestWithEvent,
  getPullRequest,
  insertPullRequest,
  listPullRequestsByHeadSha,
  pushPullRequestHead,
} from './queries/pr.ts';

export {
  insertReview,
  listReviewsForPr,
  submitReviewWithEvent,
} from './queries/review.ts';

export {
  addMention,
  listFragmentsMentioningUser,
  listUsersMentionedByFragment,
  removeMention,
  replaceMentionsForFragment,
} from './queries/mention.ts';
