/**
 * `IssueDetail` fragment: full issue page including title, body, labels,
 * and comment thread.
 *
 * Pure renderer: takes an `IssueDetailData` view-model and returns HTML.
 * The dispatcher loads the data via `data/queries.ts`, runs this
 * function, and writes the result to storage. There is no client-side
 * variation in the fragment itself; per-viewer button/reaction state
 * ships as a JSON delta in Phase 2+.
 */

import {
  jsx,
  type SafeHtml,
} from './jsx-runtime.ts';

/**
 * View-model fed to the {@link renderIssueDetail} renderer.
 */
export type IssueDetailData = {
  /**
   * Repo owner login (e.g. `alice`).
   */
  readonly ownerLogin: string;
  /**
   * Repo name.
   */
  readonly repoName: string;
  /**
   * Issue number (1-based per repo).
   */
  readonly issueNumber: number;
  /**
   * Issue title.
   */
  readonly title: string;
  /**
   * Issue body (plain text or markdown source; rendered as text in Phase 1).
   */
  readonly body: string;
  /**
   * Author login.
   */
  readonly authorLogin: string;
  /**
   * ISO timestamp of issue creation.
   */
  readonly createdAt: string;
  /**
   * Issue state label (`open` or `closed`).
   */
  readonly state: string;
  /**
   * Labels currently attached.
   */
  readonly labels: readonly {
    readonly name: string;
    readonly color: string;
  }[];
  /**
   * Comments on the issue, oldest first.
   */
  readonly comments: readonly {
    readonly id: string;
    readonly authorLogin: string;
    readonly body: string;
    readonly createdAt: string;
  }[];
};

/**
 * Renders a single label badge.
 *
 * @param props - label fields
 *
 * @returns `<span>` badge
 *
 * @example
 * ```ts
 * labelBadge({ name: 'bug', color: 'd73a4a' });
 * ```
 */
function labelBadge(props: {
  readonly name: string;
  readonly color: string;
},): SafeHtml {
  return jsx(
    'span',
    {
      className: 'forge-label',
      'data-color': props.color,
      children: props.name,
    },
  );
}

/**
 * Renders a single comment.
 *
 * @param props - comment fields
 *
 * @returns `<article>` containing comment header and body
 *
 * @example
 * ```ts
 * commentBlock({ authorLogin: 'a', body: 'b', createdAt: '...' });
 * ```
 */
function commentBlock(props: {
  readonly authorLogin: string;
  readonly body: string;
  readonly createdAt: string;
},): SafeHtml {
  return jsx(
    'article',
    {
      className: 'forge-comment',
      children: [
        jsx(
          'header',
          {
            children: [
              jsx(
                'span',
                {
                  className: 'forge-comment-author',
                  children: props.authorLogin,
                },
              ),
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
            className: 'forge-comment-body',
            children: props.body,
          },
        ),
      ],
    },
  );
}

/**
 * Renders an issue detail fragment.
 *
 * @param data - view-model for the issue
 *
 * @returns full fragment HTML
 *
 * @example
 * ```ts
 * const html = renderIssueDetail({
 *   ownerLogin: 'alice',
 *   repoName: 'test',
 *   issueNumber: 1,
 *   title: 'Bug',
 *   body: 'Repro steps...',
 *   authorLogin: 'alice',
 *   createdAt: '2026-05-06T12:00:00Z',
 *   state: 'open',
 *   labels: [],
 *   comments: [],
 * }).html;
 * ```
 */
export function renderIssueDetail(data: IssueDetailData,): SafeHtml {
  /**
   * Per-label badge HTML rendered into the header.
   */
  const labelBadges = data.labels
    .map(function eachLabel(label,) {
    return labelBadge({
      name: label.name,
      color: label.color,
    },);
  },);
  /**
   * Per-comment HTML rendered into the issue body.
   */
  const commentBlocks = data.comments
    .map(function eachComment(comment,) {
    return commentBlock({
      authorLogin: comment.authorLogin,
      body: comment.body,
      createdAt: comment.createdAt,
    },);
  },);
  return jsx(
    'section',
    {
      className: 'forge-issue-detail',
      'data-issue-number': String(data.issueNumber,),
      'data-state': data.state,
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
                        className: 'forge-issue-number',
                        children: `#${String(data.issueNumber,)}`,
                      },
                    ),
                  ],
                },
              ),
              jsx(
                'p',
                {
                  className: 'forge-issue-meta',
                  children: [
                    jsx(
                      'span',
                      {
                        className: 'forge-issue-state',
                        children: data.state,
                      },
                    ),
                    ' opened by ',
                    jsx(
                      'span',
                      {
                        className: 'forge-issue-author',
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
                    ' in ',
                    jsx(
                      'a',
                      {
                        href: `/${data.ownerLogin}/${data.repoName}`,
                        children: `${data.ownerLogin}/${data.repoName}`,
                      },
                    ),
                  ],
                },
              ),
              jsx(
                'div',
                {
                  className: 'forge-issue-labels',
                  children: labelBadges,
                },
              ),
            ],
          },
        ),
        jsx(
          'div',
          {
            className: 'forge-issue-body',
            children: data.body,
          },
        ),
        jsx(
          'div',
          {
            className: 'forge-issue-comments',
            children: commentBlocks,
          },
        ),
      ],
    },
  );
}
