/**
 * `FilterList` fragment: sorted issue-id list page.
 *
 * Per the architecture plan, filter pages (e.g. `/issues?label=bug&state=open`)
 * are stored as **sorted issue-id lists** rather than as fully rendered
 * HTML. The list contains just the ids and minimal sort metadata; the
 * page is composed at request time by stitching the list with cached
 * issue-summary fragments via the swap shim.
 *
 * Phase 1 ships a tiny renderer that emits a list with one row per
 * issue, embedding only the issue number, title, and updated timestamp.
 * Phase 2+ replaces this with the IDs-only payload + per-id summary
 * fragment lookups.
 */

import {
  jsx,
  type SafeHtml,
} from './jsx-runtime.ts';

/**
 * View-model fed to {@link renderFilterList}.
 */
export type FilterListData = {
  /**
   * Repo owner login.
   */
  readonly ownerLogin: string;
  /**
   * Repo name.
   */
  readonly repoName: string;
  /**
   * Filter facet labels for display.
   */
  readonly facetLabel: string;
  /**
   * Issue summaries, sorted by `updatedAt` desc.
   */
  readonly issues: readonly {
    readonly id: string;
    readonly number: number;
    readonly title: string;
    readonly updatedAt: string;
    readonly state: string;
  }[];
};

/**
 * Renders a single issue summary row inside the filter list.
 *
 * @param props - issue summary fields
 *
 * @returns `<li>` row
 *
 * @example
 * ```ts
 * issueRow({ ownerLogin: 'a', repoName: 'r', number: 1, title: 't', updatedAt: '...', state: 'open' });
 * ```
 */
function issueRow(props: {
  readonly ownerLogin: string;
  readonly repoName: string;
  readonly number: number;
  readonly title: string;
  readonly updatedAt: string;
  readonly state: string;
},): SafeHtml {
  return jsx(
    'li',
    {
      className: 'forge-issue-row',
      'data-state': props.state,
      children: jsx(
        'a',
        {
          href: `/${props.ownerLogin}/${props.repoName}/issues/${String(props.number,)}`,
          children: [
            jsx(
              'span',
              {
                className: 'forge-issue-number',
                children: `#${String(props.number,)}`,
              },
            ),
            ' ',
            jsx(
              'span',
              {
                className: 'forge-issue-title',
                children: props.title,
              },
            ),
            ' ',
            jsx(
              'time',
              {
                dateTime: props.updatedAt,
                children: props.updatedAt,
              },
            ),
          ],
        },
      ),
    },
  );
}

/**
 * Renders the filter-list fragment.
 *
 * @param data - view-model
 *
 * @returns fragment HTML
 *
 * @example
 * ```ts
 * const html = renderFilterList({
 *   ownerLogin: 'alice',
 *   repoName: 'test',
 *   facetLabel: 'open issues with label "bug"',
 *   issues: [],
 * }).html;
 * ```
 */
export function renderFilterList(data: FilterListData,): SafeHtml {
  /**
   * Per-issue row HTML rendered into the filter list.
   */
  const rows = data.issues
    .map(function eachIssue(issue,) {
    return issueRow({
      ownerLogin: data.ownerLogin,
      repoName: data.repoName,
      number: issue.number,
      title: issue.title,
      updatedAt: issue.updatedAt,
      state: issue.state,
    },);
  },);
  return jsx(
    'section',
    {
      className: 'forge-filter-list',
      'data-count': String(data.issues
        .length,),
      children: [
        jsx(
          'header',
          {
            children: jsx(
              'h2',
              { children: data.facetLabel, },
            ),
          },
        ),
        data.issues
          .length
          === 0
          ? jsx(
            'p',
            {
              className: 'forge-empty',
              children: 'No issues match this filter.',
            },
          )
          : jsx(
            'ul',
            {
              className: 'forge-issue-list',
              children: rows,
            },
          ),
      ],
    },
  );
}
