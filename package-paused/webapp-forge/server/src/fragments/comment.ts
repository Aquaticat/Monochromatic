/**
 * `Comment` fragment: standalone single-comment view.
 *
 * Used as a permalink target (`/owner/repo/issues/N#comment-id`) and as
 * a swap-target after a comment write so the client can append the new
 * comment to the thread without rebuilding the full issue-detail HTML.
 */

import {
  jsx,
  type SafeHtml,
} from './jsx-runtime.ts';

/**
 * View-model fed to the {@link renderComment} renderer.
 */
export type CommentData = {
  /**
   * Comment id (used in the permalink anchor).
   */
  readonly id: string;
  /**
   * Author login.
   */
  readonly authorLogin: string;
  /**
   * Comment body text.
   */
  readonly body: string;
  /**
   * ISO timestamp of creation.
   */
  readonly createdAt: string;
};

/**
 * Renders the standalone comment fragment.
 *
 * @param data - view-model for the comment
 *
 * @returns fragment HTML
 *
 * @example
 * ```ts
 * const html = renderComment({
 *   id: 'c1',
 *   authorLogin: 'alice',
 *   body: 'first',
 *   createdAt: '2026-05-06T12:00:00Z',
 * }).html;
 * ```
 */
export function renderComment(data: CommentData,): SafeHtml {
  return jsx(
    'article',
    {
      className: 'forge-comment forge-comment-standalone',
      id: `comment-${data.id}`,
      'data-comment-id': data.id,
      children: [
        jsx(
          'header',
          {
            children: [
              jsx(
                'span',
                {
                  className: 'forge-comment-author',
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
            ],
          },
        ),
        jsx(
          'div',
          {
            className: 'forge-comment-body',
            children: data.body,
          },
        ),
      ],
    },
  );
}
