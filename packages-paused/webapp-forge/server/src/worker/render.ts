/**
 * Fragment rendering glue.
 *
 * `renderFragment` resolves the source data behind a fragment key,
 * calls the appropriate renderer, and returns the HTML body. Pure
 * function of the database state (no caching, no parallelism), so
 * the dispatcher can call it from any worker context.
 */

import {
  getFragmentIndex,
  getIssue,
  getRepo,
  getUser,
  listComments,
  listIssueIdsForFilter,
  listIssueLabels,
} from '../data/queries.ts';
import {
  type FilterListData,
  renderFilterList,
} from '../fragments/filter-list.ts';
import { renderIssueDetail, } from '../fragments/issue-detail.ts';
import {
  ANY_LABEL,
  type IssueStateFacet,
} from './fragment-keys.ts';
import { fnv1a64, } from './render-hash.ts';
import { tryRenderPhase2, } from './render-phase2.ts';

/* oxlint-disable no-restricted-syntax/no-regex -- Fragment key parser; inputs are canonical keys produced by fragment-keys.ts (bounded path segments without slashes), regex is anchored with no nested quantifiers so no catastrophic backtracking is possible. */
/**
 * Pattern for issue detail fragment keys.
 */
const ISSUE_DETAIL_PATTERN = /^issues\/([^/]+)\/([^/]+)\/detail$/u;

/**
 * Pattern for filter list fragment keys.
 */
const FILTER_LIST_PATTERN = /^repos\/([^/]+)\/filters\/([^/]+)\/([^/]+)\/list$/u;
/* oxlint-enable no-restricted-syntax/no-regex */

/**
 * Result of {@link renderFragment}: the body bytes plus a content hash.
 */
export type RenderResult = {
  /**
   * UTF-8 encoded HTML body.
   */
  readonly body: Uint8Array;
  /**
   * Content-addressable hash (FNV-1a 64-bit) of the body.
   */
  readonly contentHash: string;
};

/**
 * Renders the fragment identified by `fragmentKey`.
 *
 * Throws when the key shape is unknown or when underlying data is
 * missing (e.g. the issue id no longer exists; a sign the caller
 * raced a delete).
 *
 * @param fragmentKey - canonical fragment key
 *
 * @returns rendered body + content hash
 *
 * @example
 * ```ts
 * const { body, contentHash } = await renderFragment('issues/r1/i1/detail');
 * ```
 */
export async function renderFragment(fragmentKey: string,): Promise<RenderResult> {
  /**
   * Issue-detail key match; non-null routes to the issue-detail branch.
   */
  const issueDetailMatch = ISSUE_DETAIL_PATTERN.exec(fragmentKey,);
  if (issueDetailMatch !== null) {
    /**
     * Issue id captured by the second group in `ISSUE_DETAIL_PATTERN`.
     */
    const issueId = issueDetailMatch.at(2,);
    if (issueId === undefined)
      throw new Error(`unparseable fragment key: ${fragmentKey}`,);
    return await renderIssueDetailByKey(issueId,);
  }
  /**
   * Filter-list key match; non-null routes to the filter-list branch.
   */
  const filterListMatch = FILTER_LIST_PATTERN.exec(fragmentKey,);
  if (filterListMatch !== null) {
    /**
     * Destructured filter-list groups: repo, label, state facet.
     */
    const [, repoId, labelId, stateFacet,] = filterListMatch;
    if (
      (repoId === undefined)
      || (labelId === undefined)
        || (stateFacet === undefined)
    ) {
      throw new Error(`unparseable fragment key: ${fragmentKey}`,);
    }
    if ((stateFacet !== 'open') && (stateFacet !== 'closed'))
      throw new Error(`invalid state facet in key: ${fragmentKey}`,);
    return await renderFilterListByKey({
      repoId,
      labelId,
      state: stateFacet,
    },);
  }
  /**
   * Phase 2 fragment renderer fallback; null means no kind matched the key.
   */
  const phase2 = await tryRenderPhase2(fragmentKey,);
  if (phase2 !== null)
    return phase2;
  throw new Error(`unknown fragment-key shape: ${fragmentKey}`,);
}

/**
 * Loads issue + comments + labels and runs the issue-detail renderer.
 *
 * @param issueId - issue id
 *
 * @returns rendered body + hash
 */
async function renderIssueDetailByKey(issueId: string,): Promise<RenderResult> {
  /**
   * Issue row; missing means a race against deletion.
   */
  const issue = await getIssue(issueId,);
  if (issue === undefined)
    throw new Error(`issue not found: ${issueId}`,);
  /**
   * Owning repo row; needed for owner/name fields on the rendered page.
   */
  const repo = await getRepo(issue.repo_id,);
  if (repo === undefined)
    throw new Error(`repo not found for issue ${issueId}`,);
  /**
   * Owning user record; provides login for the URL path.
   */
  const owner = await getUser(repo.owner_id,);
  if (owner === undefined)
    throw new Error(`owner not found for repo ${repo.id}`,);
  /**
   * Issue author user record; needed for the byline.
   */
  const author = await getUser(issue.author_id,);
  if (author === undefined)
    throw new Error(`author not found for issue ${issueId}`,);
  /**
   * Labels currently attached to the issue.
   */
  const labels = await listIssueLabels(issueId,);
  /**
   * Comments ordered by `created_at`.
   */
  const comments = await listComments(issueId,);

  /**
   * Unique commenter ids drive a single bulk user lookup below.
   */
  const distinctAuthorIds = new Set<string>(
    comments.map(function pickAuthorId(comment,) {
      return comment.author_id;
    },),
  );
  /**
   * Resolved `[authorId, login]` pairs; missing users degrade to 'unknown'.
   */
  const authorEntries = await Promise.all(
    [...distinctAuthorIds,].map(async function loadUser(id,) {
      /**
       * User row for one commenter, possibly `undefined` for deleted users.
       */
      const user = await getUser(id,);
      return [
        id,
        user?.login
          ?? 'unknown',
      ] as const;
    },),
  );
  /**
   * Lookup map fed to the per-comment renderer for byline display.
   */
  const commentAuthorLogins = new Map<string, string>(authorEntries,);

  /**
   * Rendered HTML for the issue-detail fragment.
   */
  const { html, } = renderIssueDetail({
    ownerLogin: owner.login,
    repoName: repo.name,
    issueNumber: issue.number,
    title: issue.title,
    body: issue.body,
    authorLogin: author.login,
    createdAt: new Date(issue.created_at,).toISOString(),
    state: issue.state,
    labels: labels.map(function eachLabel(label,) {
      return {
        name: label.name,
        color: label.color,
      };
    },),
    comments: comments.map(function eachComment(comment,) {
      return {
        id: comment.id,
        authorLogin: commentAuthorLogins.get(comment.author_id,)
          ?? 'unknown',
        body: comment.body,
        createdAt: new Date(comment.created_at,).toISOString(),
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
 * Loads filter results and runs the filter-list renderer.
 *
 * @param row - filter facets
 *
 * @returns rendered body + hash
 */
async function renderFilterListByKey(row: {
  readonly repoId: string;
  readonly labelId: string;
  readonly state: IssueStateFacet;
},): Promise<RenderResult> {
  /**
   * Owning repo row; provides name for the rendered list.
   */
  const repo = await getRepo(row.repoId,);
  if (repo === undefined)
    throw new Error(`repo not found: ${row.repoId}`,);
  /**
   * Owning user record; provides login for the URL path.
   */
  const owner = await getUser(repo.owner_id,);
  if (owner === undefined)
    throw new Error(`owner not found for repo ${row.repoId}`,);

  /**
   * Issue id rows narrowed by the filter facets.
   */
  const idRows = await listIssueIdsForFilter({
    repoId: row.repoId,
    labelId: row.labelId
      === ANY_LABEL ? null : row.labelId,
    state: row.state,
  },);

  /**
   * Hydrated issue rows in parallel; `null` entries are dropped below.
   */
  const issuesLoaded = await Promise.all(
    idRows.map(async function loadIssue(idRow,) {
      /**
       * Issue row for one id; `undefined` means concurrent deletion.
       */
      const issue = await getIssue(idRow.id,);
      if (issue === undefined)
        return null;
      return {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        updatedAt: new Date(issue.updated_at,).toISOString(),
        state: issue.state,
      };
    },),
  );
  /**
   * Non-null summaries forming the rendered list.
   */
  const summaries: FilterListData['issues'][number][] = issuesLoaded
    .filter(function notNull(value,) {
      return value !== null;
    },);

  /**
   * Human-readable facet description for the page heading.
   */
  const facetLabel = `${row.state} issues${
    row.labelId
      === ANY_LABEL ? '' : ` with label "${row.labelId}"`
  }`;

  /**
   * Rendered HTML for the filter-list fragment.
   */
  const { html, } = renderFilterList({
    ownerLogin: owner.login,
    repoName: repo.name,
    facetLabel,
    issues: summaries,
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
 * Returns the previously persisted content hash for a fragment, or
 * `undefined` when the fragment has not been built yet.
 *
 * @param fragmentKey - canonical fragment key
 *
 * @returns hash or `undefined`
 *
 * @example
 * ```ts
 * const hash = await existingContentHash('issues/r1/i1/detail');
 * ```
 */
export async function existingContentHash(
  fragmentKey: string,
): Promise<string | undefined> {
  /**
   * Fragment-index row; `undefined` when the fragment has not been built yet.
   */
  const row = await getFragmentIndex(fragmentKey,);
  return row?.content_hash;
}
