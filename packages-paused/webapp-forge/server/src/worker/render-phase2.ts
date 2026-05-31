/**
 * Phase 2 fragment rendering helpers.
 *
 * Lives next to `render.ts` to keep that file under the per-package
 * max-lines budget. Exports a single entry point, {@link tryRenderPhase2},
 * that dispatches to PR / review / merge-status / comment renderers
 * based on the fragment key shape and returns `null` when no Phase 2
 * pattern matches (so the caller can fall through to Phase 1 patterns).
 */

import {
  getComment,
  getIssue,
  getPullRequest,
  getRepo,
  getUser,
  listReviewsForPr,
} from '../data/queries.ts';
import { renderComment, } from '../fragments/comment.ts';
import {
  type MergeableState,
  renderMergeStatus,
} from '../fragments/merge-status.ts';
import { renderPrDetail, } from '../fragments/pr-detail.ts';
import { renderReviewThread, } from '../fragments/review-thread.ts';
import { fnv1a64, } from './render-hash.ts';

/**
 * Result of a render: body bytes + content hash.
 */
export type RenderResult = {
  /**
   * UTF-8 encoded HTML body.
   */
  readonly body: Uint8Array;
  /**
   * Content-addressable hash.
   */
  readonly contentHash: string;
};

/* oxlint-disable no-restricted-syntax/no-regex -- Fragment key parser; inputs are canonical keys produced by fragment-keys.ts (bounded path segments without slashes), regex is anchored with no nested quantifiers so no catastrophic backtracking is possible. */
/**
 * Pattern for PR detail fragment keys.
 */
const PR_DETAIL_PATTERN = /^prs\/([^/]+)\/([^/]+)\/detail$/u;

/**
 * Pattern for PR review-thread fragment keys.
 */
const REVIEW_THREAD_PATTERN = /^prs\/([^/]+)\/([^/]+)\/reviews$/u;

/**
 * Pattern for merge-status fragment keys.
 */
const MERGE_STATUS_PATTERN = /^prs\/([^/]+)\/([^/]+)\/merge-status$/u;

/**
 * Pattern for standalone comment fragment keys.
 */
const COMMENT_PATTERN = /^comments\/(.+)$/u;
/* oxlint-enable no-restricted-syntax/no-regex */

/**
 * Default required-approvals threshold for the merge-status panel.
 */
const DEFAULT_REQUIRED_APPROVALS = 1;

/**
 * Attempts to render the fragment if its key matches a Phase 2 shape.
 *
 * @param fragmentKey - canonical fragment key
 *
 * @returns rendered body + hash, or `null` when no Phase 2 pattern matches
 *
 * @example
 * ```ts
 * const result = await tryRenderPhase2('prs/r1/i1/detail');
 * ```
 */
export async function tryRenderPhase2(
  fragmentKey: string,
): Promise<RenderResult | null> {
  /**
   * PR-detail key match; non-null routes to the PR-detail branch.
   */
  const prDetailMatch = PR_DETAIL_PATTERN.exec(fragmentKey,);
  if (prDetailMatch !== null) {
    /**
     * Issue id captured by the second group of `PR_DETAIL_PATTERN`.
     */
    const issueId = prDetailMatch.at(2,);
    if (issueId === undefined)
      throw new Error(`unparseable fragment key: ${fragmentKey}`,);
    return await renderPrDetailByKey(issueId,);
  }
  /**
   * Review-thread key match; non-null routes to the review-thread branch.
   */
  const reviewMatch = REVIEW_THREAD_PATTERN.exec(fragmentKey,);
  if (reviewMatch !== null) {
    /**
     * Issue id captured by the second group of `REVIEW_THREAD_PATTERN`.
     */
    const issueId = reviewMatch.at(2,);
    if (issueId === undefined)
      throw new Error(`unparseable fragment key: ${fragmentKey}`,);
    return await renderReviewThreadByKey(issueId,);
  }
  /**
   * Merge-status key match; non-null routes to the merge-status branch.
   */
  const mergeMatch = MERGE_STATUS_PATTERN.exec(fragmentKey,);
  if (mergeMatch !== null) {
    /**
     * Issue id captured by the second group of `MERGE_STATUS_PATTERN`.
     */
    const issueId = mergeMatch.at(2,);
    if (issueId === undefined)
      throw new Error(`unparseable fragment key: ${fragmentKey}`,);
    return await renderMergeStatusByKey(issueId,);
  }
  /**
   * Standalone-comment key match; non-null routes to the comment branch.
   */
  const commentMatch = COMMENT_PATTERN.exec(fragmentKey,);
  if (commentMatch !== null) {
    /**
     * Comment id captured by the first group of `COMMENT_PATTERN`.
     */
    const commentId = commentMatch.at(1,);
    if (commentId === undefined)
      throw new Error(`unparseable fragment key: ${fragmentKey}`,);
    return await renderCommentByKey(commentId,);
  }
  return null;
}

/**
 * Loads PR + issue + reviews and runs the PR-detail renderer.
 *
 * @param issueId - issue id (PR's primary key)
 *
 * @returns rendered body + hash
 *
 * @example
 * ```ts
 * const result = await renderPrDetailByKey('i1');
 * ```
 */
async function renderPrDetailByKey(issueId: string,): Promise<RenderResult> {
  /**
   * Resolved PR metadata for the issue id.
   */
  const ctx = await loadPrContext(issueId,);
  /**
   * Reviews on the PR; feeds the approval counters below.
   */
  const reviews = await listReviewsForPr(issueId,);
  /**
   * Aggregated approval and changes-requested counts.
   */
  const counts = countReviewStates(reviews,);
  /**
   * Rendered HTML for the PR-detail fragment.
   */
  const { html, } = renderPrDetail({
    ownerLogin: ctx.ownerLogin,
    repoName: ctx.repoName,
    prNumber: ctx.prNumber,
    title: ctx.title,
    body: ctx.body,
    authorLogin: ctx.authorLogin,
    createdAt: ctx.createdAt,
    state: ctx.state,
    baseRef: ctx.baseRef,
    headRef: ctx.headRef,
    headSha: ctx.headSha,
    mergeable: ctx.mergeable,
    approvedCount: counts.approved,
    changesRequestedCount: counts.changesRequested,
  },);
  /**
   * UTF-8 body bytes hashed below for content-addressing.
   */
  const body = new TextEncoder().encode(html,);
  return {
    body,
    contentHash: fnv1a64(body,),
  };
}

/**
 * Loads reviews and runs the review-thread renderer.
 *
 * @param issueId - PR's issue id
 *
 * @returns rendered body + hash
 *
 * @example
 * ```ts
 * const result = await renderReviewThreadByKey('i1');
 * ```
 */
async function renderReviewThreadByKey(issueId: string,): Promise<RenderResult> {
  /**
   * Resolved PR metadata for the issue id.
   */
  const ctx = await loadPrContext(issueId,);
  /**
   * Reviews on the PR; drives both the entry list and reviewer hydration.
   */
  const reviews = await listReviewsForPr(issueId,);
  /**
   * Resolved `[reviewerId, login]` pairs; missing users degrade to 'unknown'.
   */
  const reviewerEntries = await Promise.all(
    reviews.map(async function loadReviewer(review,) {
      /**
       * Reviewer user row, possibly `undefined` for deleted users.
       */
      const reviewer = await getUser(review.reviewer_id,);
      return [
        review.reviewer_id,
        reviewer?.login
          ?? 'unknown',
      ] as const;
    },),
  );
  /**
   * Lookup map fed to the per-review renderer for byline display.
   */
  const reviewerLogins = new Map<string, string>(reviewerEntries,);
  /**
   * Rendered HTML for the review-thread fragment.
   */
  const { html, } = renderReviewThread({
    ownerLogin: ctx.ownerLogin,
    repoName: ctx.repoName,
    prNumber: ctx.prNumber,
    reviews: reviews.map(function eachReview(review,) {
      return {
        id: review.id,
        reviewerLogin: reviewerLogins.get(review.reviewer_id,)
          ?? 'unknown',
        state: review.state,
        body: review.body,
        createdAt: new Date(review.created_at,).toISOString(),
      };
    },),
  },);
  /**
   * UTF-8 body bytes hashed below for content-addressing.
   */
  const body = new TextEncoder().encode(html,);
  return {
    body,
    contentHash: fnv1a64(body,),
  };
}

/**
 * Loads PR + reviews and runs the merge-status renderer.
 *
 * @param issueId - PR's issue id
 *
 * @returns rendered body + hash
 *
 * @example
 * ```ts
 * const result = await renderMergeStatusByKey('i1');
 * ```
 */
async function renderMergeStatusByKey(issueId: string,): Promise<RenderResult> {
  /**
   * Resolved PR metadata for the issue id.
   */
  const ctx = await loadPrContext(issueId,);
  /**
   * Reviews on the PR; feeds the approval counters below.
   */
  const reviews = await listReviewsForPr(issueId,);
  /**
   * Aggregated approval and changes-requested counts.
   */
  const counts = countReviewStates(reviews,);
  /**
   * Rendered HTML for the merge-status fragment.
   */
  const { html, } = renderMergeStatus({
    prNumber: ctx.prNumber,
    mergeable: ctx.mergeable,
    approvedCount: counts.approved,
    changesRequestedCount: counts.changesRequested,
    requiredApprovals: DEFAULT_REQUIRED_APPROVALS,
  },);
  /**
   * UTF-8 body bytes hashed below for content-addressing.
   */
  const body = new TextEncoder().encode(html,);
  return {
    body,
    contentHash: fnv1a64(body,),
  };
}

/**
 * Loads a single comment + author and runs the standalone-comment renderer.
 *
 * @param commentId - comment id
 *
 * @returns rendered body + hash
 *
 * @example
 * ```ts
 * const result = await renderCommentByKey('c1');
 * ```
 */
async function renderCommentByKey(commentId: string,): Promise<RenderResult> {
  /**
   * Comment row; missing means a race against deletion.
   */
  const comment = await getComment(commentId,);
  if (comment === undefined)
    throw new Error(`comment not found: ${commentId}`,);
  /**
   * Author user record; missing degrades to 'unknown' login.
   */
  const author = await getUser(comment.author_id,);
  /**
   * Rendered HTML for the standalone-comment fragment.
   */
  const { html, } = renderComment({
    id: comment.id,
    authorLogin: author?.login
      ?? 'unknown',
    body: comment.body,
    createdAt: new Date(comment.created_at,).toISOString(),
  },);
  /**
   * UTF-8 body bytes hashed below for content-addressing.
   */
  const body = new TextEncoder().encode(html,);
  return {
    body,
    contentHash: fnv1a64(body,),
  };
}

/**
 * Aggregated counts used by both the PR-detail and merge-status renderers.
 */
type ReviewCounts = {
  readonly approved: number;
  readonly changesRequested: number;
};

/**
 * Counts approved / changes-requested reviews ignoring `commented`.
 *
 * @param reviews - reviews list
 *
 * @returns aggregated counts
 *
 * @example
 * ```ts
 * countReviewStates([{state:'approved'}, {state:'changes_requested'}]);
 * // { approved: 1, changesRequested: 1 }
 * ```
 */
function countReviewStates(
  reviews: readonly { readonly state: string; }[],
): ReviewCounts {
  return reviews.reduce(
    function tallyReviewState(
      counts: ReviewCounts,
      review: { readonly state: string; },
    ): ReviewCounts {
      if (review.state
        === 'approved') {
        return {
          approved: counts.approved
            + 1,
          changesRequested: counts.changesRequested,
        };
      }
      if (review.state
        === 'changes_requested') {
        return {
          approved: counts.approved,
          changesRequested: counts.changesRequested
            + 1,
        };
      }
      return counts;
    },
    {
      approved: 0,
      changesRequested: 0,
    },
  );
}

/**
 * Resolved metadata bundle every PR-related Phase 2 renderer needs.
 */
type PrContext = {
  ownerLogin: string;
  repoName: string;
  prNumber: number;
  title: string;
  body: string;
  authorLogin: string;
  createdAt: string;
  state: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  mergeable: MergeableState;
};

/**
 * Loads issue + PR + repo + owner + author for a PR-related render.
 *
 * @param issueId - PR's issue id
 *
 * @returns resolved context
 *
 * @example
 * ```ts
 * const ctx = await loadPrContext('i1');
 * ```
 */
async function loadPrContext(issueId: string,): Promise<PrContext> {
  /**
   * Issue row backing the PR; missing means a race against deletion.
   */
  const issue = await getIssue(issueId,);
  if (issue === undefined)
    throw new Error(`issue not found: ${issueId}`,);
  /**
   * PR-specific row; missing means the issue is not actually a PR.
   */
  const pr = await getPullRequest(issueId,);
  if (pr === undefined)
    throw new Error(`pr not found: ${issueId}`,);
  /**
   * Owner+repo bundle; helper centralises the dual lookup.
   */
  const repoOwner = await loadRepoOwner(issue.repo_id,);
  /**
   * Author user record; missing degrades to 'unknown' login.
   */
  const author = await getUser(issue.author_id,);
  return {
    ownerLogin: repoOwner.ownerLogin,
    repoName: repoOwner.repoName,
    prNumber: issue.number,
    title: issue.title,
    body: issue.body,
    authorLogin: author?.login
      ?? 'unknown',
    createdAt: new Date(issue.created_at,).toISOString(),
    state: issue.state,
    baseRef: pr.base_ref,
    headRef: pr.head_ref,
    headSha: pr.head_sha,
    mergeable: normaliseMergeable(pr.mergeable,),
  };
}

/**
 * Loads `(ownerLogin, repoName)` for a repo id.
 *
 * @param repoId - repo id
 *
 * @returns owner + name pair
 *
 * @example
 * ```ts
 * const r = await loadRepoOwner('r1');
 * ```
 */
async function loadRepoOwner(repoId: string,): Promise<{
  ownerLogin: string;
  repoName: string;
}> {
  /**
   * Repo row; missing means the repo no longer exists.
   */
  const repo = await getRepo(repoId,);
  if (repo === undefined)
    throw new Error(`repo not found: ${repoId}`,);
  /**
   * Owning user row; missing means a dangling foreign key.
   */
  const owner = await getUser(repo.owner_id,);
  if (owner === undefined)
    throw new Error(`owner not found for repo ${repoId}`,);
  return {
    ownerLogin: owner.login,
    repoName: repo.name,
  };
}

/**
 * Forces an arbitrary string into the `MergeableState` discriminant,
 * defaulting unknown values to `'unknown'` rather than throwing.
 *
 * @param raw - the string stored in `prs.mergeable`
 *
 * @returns one of `'unknown' | 'clean' | 'conflicts'`
 *
 * @example
 * ```ts
 * normaliseMergeable('clean'); // 'clean'
 * normaliseMergeable('weird'); // 'unknown'
 * ```
 */
function normaliseMergeable(raw: string,): MergeableState {
  if ((raw === 'clean') || (raw === 'conflicts'))
    return raw;
  return 'unknown';
}
