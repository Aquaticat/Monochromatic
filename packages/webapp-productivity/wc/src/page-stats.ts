/**
 * Stats section markup for the wc text-stats tool: the label/id/field
 * mapping and the `<dl>` it renders into.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type { TextStats, } from './stats/index.ts';

/**
 * One row of the Stats section: a display label paired with the DOM id and
 * {@link TextStats} field the client script writes that field's value to.
 */
export type StatRow = Readonly<{
  /**
   * Display label shown in the `<dt>`.
   */
  label: string;
  /**
   * DOM id the client script writes this stat's value to.
   */
  id: string;
  /**
   * {@link TextStats} field this row displays.
   */
  key: keyof TextStats;
}>;

/**
 * Every Stats section row, in display order. Exported so the client script
 * can reuse the same label/id/{@link TextStats} field mapping instead of
 * duplicating it.
 */
export const STAT_ROWS: readonly StatRow[] = [
  {
    label: 'Bytes',
    id: 'stat-bytes',
    key: 'bytes',
  },
  {
    label: 'Chars',
    id: 'stat-chars',
    key: 'chars',
  },
  {
    label: 'Lines',
    id: 'stat-lines',
    key: 'lines',
  },
  {
    label: 'Max line length',
    id: 'stat-max-line-length',
    key: 'maxLineLength',
  },
  {
    label: 'Words',
    id: 'stat-words',
    key: 'words',
  },
  {
    label: 'Max word length',
    id: 'stat-max-word-length',
    key: 'maxWordLength',
  },
  {
    label: 'Sentences',
    id: 'stat-sentences',
    key: 'sentences',
  },
  {
    label: 'Max sentence length',
    id: 'stat-max-sentence-length',
    key: 'maxSentenceLength',
  },
  {
    label: 'Paragraphs',
    id: 'stat-paragraphs',
    key: 'paragraphs',
  },
  {
    label: 'Max paragraph length',
    id: 'stat-max-paragraph-length',
    key: 'maxParagraphLength',
  },
];

/**
 * Renders every {@link STAT_ROWS} entry as a `<div class="stat-row">`
 * wrapping a `<dt>`/`<dd>` pair, each value starting at `0` until the
 * client script computes real stats. Wrapped so each pair can lay itself
 * out with flexbox instead of a CSS grid.
 *
 * @returns HTML string for every stat row, in order
 */
function renderStatRows(): string {
  /**
   * `<div class="stat-row">` HTML strings collected by one pass over
   * {@link STAT_ROWS}.
   */
  const rows: string[] = [];

  for (const {
    label,
    id,
  } of STAT_ROWS) {
    rows.push(
      h(
        {
          tag: 'div',
          class: 'stat-row',
          children: [
            h(
              {
                tag: 'dt',
                text: label,
              },
            ),
            h(
              {
                tag: 'dd',
                attrs: { id, },
                text: '0',
              },
            ),
          ],
        },
      ),
    );
  }

  return rows.join('',);
}

/**
 * Renders the Stats section: a heading and the {@link STAT_ROWS} definition
 * list, via {@link renderStatRows}.
 *
 * @returns HTML string for the Stats section
 *
 * @example
 * ```ts
 * const statsSection = renderStatsSection();
 * ```
 */
export function renderStatsSection(): string {
  return h(
    {
      tag: 'section',
      children: [
        h(
          {
            tag: 'h2',
            text: 'Stats',
          },
        ),
        h(
          {
            tag: 'dl',
            attrs: { class: 'stats', },
            html: renderStatRows(),
          },
        ),
      ],
    },
  );
}
