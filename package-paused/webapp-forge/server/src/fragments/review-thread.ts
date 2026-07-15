/**
 * `ReviewThread` fragment: chronological list of reviews on a PR.
 *
 * Pure renderer; the dispatcher rebuilds this on `review.submitted`.
 * Sits as a sibling to `pr-detail` (each is its own swap target so a new
 * review does not invalidate the PR header).
 */

import {
  jsx,
  type SafeHtml,
} from './jsx-runtime.ts';

/**
 * Single review row in {@link ReviewThreadData.reviews}.
 */
export type ReviewRowData = {
  /**
   * Review id.
   */
  readonly id: string;
  /**
   * Reviewer login.
   */
  readonly reviewerLogin: string;
  /**
   * Review state: `approved` | `changes_requested` | `commented`.
   */
  readonly state: string;
  /**
   * Review body text.
   */
  readonly body: string;
  /**
   * ISO timestamp of submission.
   */
  readonly createdAt: string;
};

/**
 * View-model fed to the {@link renderReviewThread} renderer.
 */
export type ReviewThreadData = {
  /**
   * Repo owner login.
   */
  readonly ownerLogin: string;
  /**
   * Repo name.
   */
  readonly repoName: string;
  /**
   * PR number.
   */
  readonly prNumber: number;
  /**
   * Reviews in chronological order.
   */
  readonly reviews: readonly ReviewRowData[];
};

/**
 * Renders one review row.
 *
 * @param props - review fields
 *
 * @returns `<article>` for the review
 *
 * @example
 * ```ts
 * reviewBlock({ id: 'r1', reviewerLogin: 'a', state: 'approved', body: '', createdAt: '...' });
 * ```
 */
function reviewBlock(props: ReviewRowData,): SafeHtml {
  return jsx(
    'article',
    {
      className: 'forge-review',
      'data-state': props.state,
      'data-review-id': props.id,
      children: [
        jsx(
          'header',
          {
            children: [
              jsx(
                'span',
                {
                  className: 'forge-review-author',
                  children: props.reviewerLogin,
                },
              ),
              ' ',
              jsx(
                'span',
                {
                  className: 'forge-review-state',
                  children: props.state,
                },
              ),
              ' on ',
              jsx(
                'time',
                {
                  dateTime: props.createdAt,
                  children: props.createdAt,
                },
              ),
            ],
          },
        ),
        jsx(
          'div',
          {
            className: 'forge-review-body',
            children: props.body,
          },
        ),
      ],
    },
  );
}

/**
 * Renders the review thread fragment.
 *
 * @param data - view-model for the thread
 *
 * @returns full fragment HTML
 *
 * @example
 * ```ts
 * const html = renderReviewThread({
 *   ownerLogin: 'alice',
 *   repoName: 'demo',
 *   prNumber: 42,
 *   reviews: [],
 * }).html;
 * ```
 */
export function renderReviewThread(data: ReviewThreadData,): SafeHtml {
  /**
   * Per-review HTML blocks composing the rendered thread.
   */
  const blocks = data.reviews
    .map(function eachReview(review,) {
    return reviewBlock(review,);
  },);
  return jsx(
    'section',
    {
      className: 'forge-review-thread',
      'data-pr-number': String(data.prNumber,),
      'data-review-count': String(data.reviews
        .length,),
      children: blocks.length
        === 0
        ? jsx(
          'p',
          {
            className: 'forge-review-thread-empty',
            children: 'No reviews yet.',
          },
        )
        : blocks,
    },
  );
}
