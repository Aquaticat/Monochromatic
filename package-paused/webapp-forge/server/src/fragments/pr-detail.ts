/**
 * `PrDetail` fragment: pull-request page including header, branches, and
 * mergeable status; review thread and merge-status panel are sibling
 * fragments that swap into placeholders independently.
 *
 * Pure renderer: takes a `PrDetailData` view-model and returns escape-safe
 * HTML. The dispatcher loads the source via `data/queries.ts`'s PR + issue
 * helpers, runs this function, content-hashes the result, and writes
 * through the write-buffer like every other fragment.
 */

import {
  jsx,
  type SafeHtml,
} from './jsx-runtime.ts';

/**
 * View-model fed to the {@link renderPrDetail} renderer.
 */
export type PrDetailData = {
  /**
   * Repo owner login.
   */
  readonly ownerLogin: string;
  /**
   * Repo name.
   */
  readonly repoName: string;
  /**
   * PR number (shared with the issue number).
   */
  readonly prNumber: number;
  /**
   * PR title.
   */
  readonly title: string;
  /**
   * PR body (rendered as text in Phase 2).
   */
  readonly body: string;
  /**
   * Author login.
   */
  readonly authorLogin: string;
  /**
   * ISO timestamp of opening.
   */
  readonly createdAt: string;
  /**
   * PR state: `open`, `closed`, `merged`.
   */
  readonly state: string;
  /**
   * Base ref (e.g. `refs/heads/main`).
   */
  readonly baseRef: string;
  /**
   * Head ref (e.g. `refs/heads/feat-x`).
   */
  readonly headRef: string;
  /**
   * Head commit SHA.
   */
  readonly headSha: string;
  /**
   * Mergeability discriminant: `unknown` | `clean` | `conflicts`.
   */
  readonly mergeable: string;
  /**
   * Approved review count.
   */
  readonly approvedCount: number;
  /**
   * Changes-requested review count.
   */
  readonly changesRequestedCount: number;
};

/**
 * Renders the PR detail fragment.
 *
 * @param data - view-model for the PR
 *
 * @returns full fragment HTML
 *
 * @example
 * ```ts
 * const html = renderPrDetail({
 *   ownerLogin: 'alice',
 *   repoName: 'demo',
 *   prNumber: 42,
 *   title: 'Add feature',
 *   body: 'Description...',
 *   authorLogin: 'alice',
 *   createdAt: '2026-05-06T12:00:00Z',
 *   state: 'open',
 *   baseRef: 'refs/heads/main',
 *   headRef: 'refs/heads/feat-x',
 *   headSha: 'abc...',
 *   mergeable: 'unknown',
 *   approvedCount: 0,
 *   changesRequestedCount: 0,
 * }).html;
 * ```
 */
export function renderPrDetail(data: PrDetailData,): SafeHtml {
  return jsx(
    'section',
    {
      className: 'forge-pr-detail',
      'data-pr-number': String(data.prNumber,),
      'data-state': data.state,
      'data-mergeable': data.mergeable,
      children: [
        jsx(
          'header',
          {
            children: [
              jsx(
                'h1',
                {
                  children: [
                    `${data.title} `,
                    jsx(
                      'span',
                      {
                        className: 'forge-pr-number',
                        children: `#${String(data.prNumber,)}`,
                      },
                    ),
                  ],
                },
              ),
              jsx(
                'p',
                {
                  className: 'forge-pr-meta',
                  children: [
                    jsx(
                      'span',
                      {
                        className: 'forge-pr-state',
                        children: data.state,
                      },
                    ),
                    ' opened by ',
                    jsx(
                      'span',
                      {
                        className: 'forge-pr-author',
                        children: data.authorLogin,
                      },
                    ),
                    ' on ',
                    jsx(
                      'time',
                      {
                        dateTime: data.createdAt,
                        children: data.createdAt,
                      },
                    ),
                    ' wants to merge ',
                    jsx(
                      'code',
                      {
                        className: 'forge-pr-head',
                        children: data.headRef,
                      },
                    ),
                    ' into ',
                    jsx(
                      'code',
                      {
                        className: 'forge-pr-base',
                        children: data.baseRef,
                      },
                    ),
                  ],
                },
              ),
              jsx(
                'p',
                {
                  className: 'forge-pr-reviews-summary',
                  children: [
                    jsx(
                      'span',
                      {
                        className: 'forge-pr-approved',
                        'data-count': String(data.approvedCount,),
                        children: `${String(data.approvedCount,)} approved`,
                      },
                    ),
                    ' / ',
                    jsx(
                      'span',
                      {
                        className: 'forge-pr-changes-requested',
                        'data-count': String(data.changesRequestedCount,),
                        children: `${
                          String(data.changesRequestedCount,)
                        } changes requested`,
                      },
                    ),
                  ],
                },
              ),
            ],
          },
        ),
        jsx(
          'div',
          {
            className: 'forge-pr-body',
            children: data.body,
          },
        ),
        jsx(
          'div',
          {
            className: 'forge-pr-head-sha',
            'data-sha': data.headSha,
            children: data.headSha,
          },
        ),
      ],
    },
  );
}
