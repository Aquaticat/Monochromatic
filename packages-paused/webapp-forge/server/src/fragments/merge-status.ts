/**
 * `MergeStatus` fragment: small panel showing whether a PR is mergeable.
 *
 * Pure renderer; the dispatcher rebuilds this on `pr.opened`, `push`,
 * `review.submitted`, and `pr.merged`/`pr.closed`. Distinct from `pr-detail`
 * so a frequent recompute (push to head ref) does not invalidate the
 * PR header HTML.
 */

import {
  jsx,
  type SafeHtml,
} from './jsx-runtime.ts';

/**
 * Recognised mergeability values.
 */
export type MergeableState = 'unknown' | 'clean' | 'conflicts';

/**
 * View-model fed to the {@link renderMergeStatus} renderer.
 */
export type MergeStatusData = {
  /**
   * PR number for the panel header.
   */
  readonly prNumber: number;
  /**
   * Mergeability discriminant.
   */
  readonly mergeable: MergeableState;
  /**
   * Approved review count.
   */
  readonly approvedCount: number;
  /**
   * Changes-requested review count.
   */
  readonly changesRequestedCount: number;
  /**
   * Required-approvals threshold (0 if unconfigured).
   */
  readonly requiredApprovals: number;
};

/**
 * Returns a human-readable summary line for the panel.
 *
 * @param data - panel inputs
 *
 * @returns summary line text
 *
 * @example
 * ```ts
 * summarize({
 *   prNumber: 42,
 *   mergeable: 'clean',
 *   approvedCount: 1,
 *   changesRequestedCount: 0,
 *   requiredApprovals: 1,
 * });
 * ```
 */
function summarize(data: MergeStatusData,): string {
  if (data.mergeable
    === 'conflicts')
    return 'Merge conflicts must be resolved before merging.';
  if (data.changesRequestedCount
    > 0)
    return 'Changes have been requested; address them before merging.';
  if (data.approvedCount
    < data
    .requiredApprovals) {
    return `Needs ${
      String(data.requiredApprovals
        - data
        .approvedCount,)
    } more approval(s) before merging.`;
  }
  if (data.mergeable
    === 'clean')
    return 'Ready to merge.';
  return 'Mergeability is being computed.';
}

/**
 * Renders the merge-status fragment.
 *
 * @param data - view-model for the panel
 *
 * @returns full fragment HTML
 *
 * @example
 * ```ts
 * const html = renderMergeStatus({
 *   prNumber: 42,
 *   mergeable: 'clean',
 *   approvedCount: 1,
 *   changesRequestedCount: 0,
 *   requiredApprovals: 1,
 * }).html;
 * ```
 */
export function renderMergeStatus(data: MergeStatusData,): SafeHtml {
  return jsx(
    'aside',
    {
      className: 'forge-merge-status',
      'data-pr-number': String(data.prNumber,),
      'data-mergeable': data.mergeable,
      children: [
        jsx(
          'h2',
          {
            className: 'forge-merge-status-title',
            children: 'Merge status',
          },
        ),
        jsx(
          'p',
          {
            className: 'forge-merge-status-summary',
            children: summarize(data,),
          },
        ),
        jsx(
          'dl',
          {
            className: 'forge-merge-status-counts',
            children: [
              jsx(
                'dt',
                { children: 'Approved', },
              ),
              jsx(
                'dd',
                { children: String(data.approvedCount,), },
              ),
              jsx(
                'dt',
                { children: 'Changes requested', },
              ),
              jsx(
                'dd',
                { children: String(data.changesRequestedCount,), },
              ),
              jsx(
                'dt',
                { children: 'Required approvals', },
              ),
              jsx(
                'dd',
                { children: String(data.requiredApprovals,), },
              ),
            ],
          },
        ),
      ],
    },
  );
}
