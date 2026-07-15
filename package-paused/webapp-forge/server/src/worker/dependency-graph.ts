/**
 * Event-kind to fragment-key dependency map.
 *
 * The pipeline calls {@link dependenciesFor} after every event. The function
 * is pure: same inputs produce same outputs, no globals, no I/O. The
 * caller pre-resolves the metadata it needs (current labels, repo id) and
 * passes them in via {@link ResolvedEventContext}.
 *
 * Phase 1 handles `comment.created`, `issue.created`, `issue.labeled`.
 * Phases 2+ extend with `push`, `user.renamed`, `pr.merged`, etc.
 */

import type { EventKind, } from '../data/queries.ts';
import {
  ANY_LABEL,
  commentKey,
  filterListKey,
  issueDetailKey,
  type IssueStateFacet,
  mergeStatusKey,
  prDetailKey,
  reviewThreadKey,
} from './fragment-keys.ts';

/**
 * Discriminated event-input shape consumed by the dependency graph.
 */
export type EventInput = {
  /**
   * Event-kind discriminant.
   */
  readonly kind: EventKind;

  /**
   * Resource id. For Phase 1's issue + comment + label events this is the
   * issue id. For Phase 2's PR events this is the PR's issue id (PRs
   * share identity with issues).
   */
  readonly resourceId: string;

  /**
   * Comment id, set on `comment.created` events. When present the dep
   * graph emits a standalone-comment fragment key in addition to the
   * issue-detail rebuild.
   */
  readonly commentId?: string;
};

/**
 * Pre-resolved metadata for an event.
 *
 * The caller is responsible for fetching `repoId`, the issue's current
 * label set, and the repo's full label set (used to enumerate every
 * `(label, state)` filter list whose membership might have changed).
 */
export type ResolvedEventContext = {
  /**
   * Owning repository id of the issue this event targets.
   */
  readonly repoId: string;

  /**
   * Current labels on the issue.
   */
  readonly issueLabelIds: readonly string[];

  /**
   * All labels defined in the owning repo.
   */
  readonly repoLabelIds: readonly string[];

  /**
   * Current state of the issue.
   */
  readonly issueState: IssueStateFacet;
};

/**
 * Both states get a filter-list fragment per label facet.
 */
const ALL_STATES: readonly IssueStateFacet[] = [
  'open',
  'closed',
];

/**
 * Returns the set of fragment keys whose content depends on this event.
 *
 * For Phase 1 events, every event affects the issue detail fragment plus
 * every filter list whose membership or sort order depends on the issue.
 * That includes:
 *
 * - `(*, state)` for the issue's current state; the issue appears here
 * - every `(labelId, state)` for the issue's current labels in its current state
 * - the corresponding entries in the *opposite* state, since `issue.labeled`
 *   cannot change the issue's state today but the union still has to cover
 *   future state-change events deterministically
 *
 * @param row - event header plus pre-resolved issue metadata
 *
 * @returns fragment keys to rebuild (deduplicated `Set`)
 *
 * @example
 * ```ts
 * dependenciesFor({
 *   event: { kind: 'comment.created', resourceId: 'i1' },
 *   context: { repoId: 'r1', issueLabelIds: ['bug'], repoLabelIds: ['bug', 'feat'], issueState: 'open' },
 * });
 * // Set {
 * //   'issues/r1/i1/detail',
 * //   'repos/r1/filters/* /open/list',
 * //   'repos/r1/filters/bug/open/list',
 * //   ...
 * // }
 * ```
 */
export function dependenciesFor(row: {
  /**
   * Event header used for routing decisions.
   */
  readonly event: EventInput;
  /**
   * Issue context (repo, labels, state) needed for fanning out filter-list keys.
   */
  readonly context: ResolvedEventContext;
},): Set<string> {
  /**
   * Aliases destructured up front so the fanning-out branches stay readable.
   */
  const {
    event,
    context,
  } = row;
  /**
   * Dependency keys accumulating as branches below resolve.
   */
  const keysIterable: string[] = [
    issueDetailKey({
      repoId: context.repoId,
      issueId: event.resourceId,
    },),
  ];

  // Every issue-targeted event invalidates the no-filter list for both
  // states (sort order changes whenever updated_at moves) plus the
  // per-label list for every label currently attached.
  for (const state of ALL_STATES) {
    keysIterable.push(filterListKey({
      repoId: context.repoId,
      labelId: ANY_LABEL,
      state,
    },),);
    for (const labelId of context.issueLabelIds) {
      keysIterable.push(filterListKey({
        repoId: context.repoId,
        labelId,
        state,
      },),);
    }
  }

  // For `issue.labeled` we do not yet know which prior label set the
  // issue had, so callers that mutate labels must invalidate every repo
  // label's filter list; we approximate by always including each repo
  // label in the current state to cover the "issue removed from filter"
  // case as well as the "issue added to filter" case.
  if (event.kind
    === 'issue.labeled') {
    for (const labelId of context.repoLabelIds) {
      keysIterable.push(filterListKey({
        repoId: context.repoId,
        labelId,
        state: context.issueState,
      },),);
    }
  }

  // `comment.created` rebuilds the standalone comment fragment so swap
  // targets and permalinks have the new HTML available.
  if ((event.kind
    === 'comment.created') && (event.commentId
      !== undefined))
    keysIterable.push(commentKey(event.commentId,),);

  // PR-lifecycle events fan out to the PR-specific fragments (detail,
  // merge-status, reviews) in addition to the issue-detail and filter
  // lists already added above (PR shares identity with issue).
  if (
    (event.kind
      === 'pr.opened')
    || (event.kind
      === 'pr.merged')
      || (event.kind
        === 'pr.closed')
      || (event.kind
        === 'review.submitted')
      || (event.kind
        === 'push')
  ) {
    keysIterable.push(prDetailKey({
      repoId: context.repoId,
      issueId: event.resourceId,
    },),);
    keysIterable.push(mergeStatusKey({
      repoId: context.repoId,
      issueId: event.resourceId,
    },),);
  }

  // Review-thread fragment rebuilds when the thread itself changes
  // (new review) or when a PR transition resets review counts.
  if (
    (event.kind
      === 'review.submitted')
    || (event.kind
      === 'pr.opened')
      || (event.kind
        === 'pr.merged')
      || (event.kind
        === 'pr.closed')
  ) {
    keysIterable.push(reviewThreadKey({
      repoId: context.repoId,
      issueId: event.resourceId,
    },),);
  }

  return new Set<string>(keysIterable,);
}
