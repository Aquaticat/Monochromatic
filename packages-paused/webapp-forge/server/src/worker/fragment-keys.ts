/**
 * Canonical fragment-key encoders.
 *
 * Fragment keys are content-addressable strings used both as map keys
 * inside the fragment index (`fragment_index.fragment_key`) and as
 * relative paths in the storage backend.
 *
 * Phase 1 emits:
 *
 * - `issues/{repo_id}/{issue_id}/detail`: single issue detail page
 * - `repos/{repo_id}/filters/{labelId|*}/{state}/list`: filtered issue list
 *
 * Phase 2 adds:
 *
 * - `prs/{repo_id}/{issue_id}/detail`: pull-request detail
 * - `prs/{repo_id}/{issue_id}/reviews`: review thread
 * - `prs/{repo_id}/{issue_id}/merge-status`: merge readiness panel
 * - `comments/{comment_id}`: standalone comment (permalink + swap target)
 * - `repos/{repo_id}/tree/{ref}/{path}`: file tree (git-backed; lands with task #16)
 * - `repos/{repoId}/blob/{ref}/{path}`: blob view (git-backed)
 * - `repos/{repoId}/diff/{base_sha}/{head_sha}`: commit diff (git-backed)
 *
 * The key namespace is forwards-compatible because every kind is prefixed by
 * its resource family.
 */

/**
 * Sentinel used for the "any" filter facet (no label filter applied).
 */
export const ANY_LABEL = '*' as const;

/**
 * Allowed values for the issue state facet.
 */
export type IssueStateFacet = 'open' | 'closed';

/**
 * Encodes the detail fragment key for an issue.
 *
 * @param row - repo and issue identifiers
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * issueDetailKey({ repoId: 'r1', issueId: 'i1' });
 * // 'issues/r1/i1/detail'
 * ```
 */
export function issueDetailKey(row: {
  readonly repoId: string;
  readonly issueId: string;
},): string {
  return `issues/${row.repoId}/${row.issueId}/detail`;
}

/**
 * Encodes a filter-list fragment key.
 *
 * Pass {@link ANY_LABEL} for `labelId` to encode the no-filter list.
 *
 * @param row - filter facets
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * filterListKey({ repoId: 'r1', labelId: 'bug', state: 'open' });
 * // 'repos/r1/filters/bug/open/list'
 * ```
 */
export function filterListKey(row: {
  readonly repoId: string;
  readonly labelId: string;
  readonly state: IssueStateFacet;
},): string {
  return `repos/${row.repoId}/filters/${row.labelId}/${row.state}/list`;
}

/**
 * Encodes the PR detail fragment key.
 *
 * @param row - repo and PR identifiers (PR shares its id with the issue)
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * prDetailKey({ repoId: 'r1', issueId: 'i1' });
 * // 'prs/r1/i1/detail'
 * ```
 */
export function prDetailKey(row: {
  readonly repoId: string;
  readonly issueId: string;
},): string {
  return `prs/${row.repoId}/${row.issueId}/detail`;
}

/**
 * Encodes the review-thread fragment key for a PR.
 *
 * @param row - repo and PR identifiers
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * reviewThreadKey({ repoId: 'r1', issueId: 'i1' });
 * // 'prs/r1/i1/reviews'
 * ```
 */
export function reviewThreadKey(row: {
  readonly repoId: string;
  readonly issueId: string;
},): string {
  return `prs/${row.repoId}/${row.issueId}/reviews`;
}

/**
 * Encodes the merge-status fragment key for a PR.
 *
 * @param row - repo and PR identifiers
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * mergeStatusKey({ repoId: 'r1', issueId: 'i1' });
 * // 'prs/r1/i1/merge-status'
 * ```
 */
export function mergeStatusKey(row: {
  readonly repoId: string;
  readonly issueId: string;
},): string {
  return `prs/${row.repoId}/${row.issueId}/merge-status`;
}

/**
 * Encodes the standalone comment fragment key.
 *
 * Used for permalinks and as a swap-target after a comment write so the
 * client can drop the new comment into the thread without rebuilding the
 * full issue-detail HTML.
 *
 * @param commentId - comment id
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * commentKey('c1');
 * // 'comments/c1'
 * ```
 */
export function commentKey(commentId: string,): string {
  return `comments/${commentId}`;
}

/**
 * Encodes the file-tree fragment key for a repo at a given ref + path.
 *
 * Refs and paths are kept as-is (`/` is preserved). Callers must ensure
 * the ref does not contain `..` segments; the dispatcher does its own
 * validation when consuming push events.
 *
 * @param row - repo, ref, and path
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * fileTreeKey({ repoId: 'r1', ref: 'main', path: 'src/lib' });
 * // 'repos/r1/tree/main/src/lib'
 * ```
 */
export function fileTreeKey(row: {
  readonly repoId: string;
  readonly ref: string;
  readonly path: string;
},): string {
  return `repos/${row.repoId}/tree/${row.ref}/${row.path}`;
}

/**
 * Encodes the blob fragment key for a repo at a given ref + path.
 *
 * @param row - repo, ref, and path
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * blobKey({ repoId: 'r1', ref: 'main', path: 'src/lib/util.ts' });
 * // 'repos/r1/blob/main/src/lib/util.ts'
 * ```
 */
export function blobKey(row: {
  readonly repoId: string;
  readonly ref: string;
  readonly path: string;
},): string {
  return `repos/${row.repoId}/blob/${row.ref}/${row.path}`;
}

/**
 * Encodes the diff fragment key for a repo between two commits.
 *
 * @param row - repo and commit SHAs
 *
 * @returns canonical fragment key
 *
 * @example
 * ```ts
 * diffKey({ repoId: 'r1', baseSha: 'abc', headSha: 'def' });
 * // 'repos/r1/diff/abc/def'
 * ```
 */
export function diffKey(row: {
  readonly repoId: string;
  readonly baseSha: string;
  readonly headSha: string;
},): string {
  return `repos/${row.repoId}/diff/${row.baseSha}/${row.headSha}`;
}
