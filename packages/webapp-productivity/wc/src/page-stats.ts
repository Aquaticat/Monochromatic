/**
 * Stats section markup for the wc text-stats tool: six paired stat tiles.
 *
 * Lines, words, sentences, and paragraphs each pair a headline count with
 * a "longest" sub-stat; bytes and chars stand alone. The pairing halves
 * the tile count and demotes the maxima to secondary lines instead of
 * giving them equal billing with the counts.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type { TextStats, } from './stats/index.ts';

/**
 * Sub-stat of a tile: the "longest" line under the headline count.
 */
export type StatSub = Readonly<{
  /**
   * DOM id the client script writes this sub-stat's value to.
   */
  id: string;
  /**
   * {@link TextStats} field this sub-stat displays.
   */
  key: keyof TextStats;
  /**
   * Unit word rendered after the value, disambiguating what "longest"
   * measures (max sentence length is in words, max paragraph length in
   * sentences).
   */
  unit: string;
}>;

/**
 * One stat tile: a display label, the DOM id and {@link TextStats} field
 * of its headline count, and optionally a "longest" sub-stat.
 */
export type StatTile = Readonly<{
  /**
   * Display label shown above the headline count.
   */
  label: string;
  /**
   * DOM id the client script writes the headline count to.
   */
  id: string;
  /**
   * {@link TextStats} field the headline count displays.
   */
  key: keyof TextStats;
  /**
   * Optional "longest" sub-stat rendered under the headline count.
   */
  sub?: StatSub;
}>;

/**
 * Every stat tile, in display order. Exported so the client script can
 * reuse the same id/{@link TextStats} field mapping instead of
 * duplicating it.
 */
export const STAT_TILES: readonly StatTile[] = [
  {
    label: 'Words',
    id: 'stat-words',
    key: 'words',
    sub: {
      id: 'stat-max-word-length',
      key: 'maxWordLength',
      unit: 'chars',
    },
  },
  {
    label: 'Chars',
    id: 'stat-chars',
    key: 'chars',
  },
  {
    label: 'Bytes',
    id: 'stat-bytes',
    key: 'bytes',
  },
  {
    label: 'Lines',
    id: 'stat-lines',
    key: 'lines',
    sub: {
      id: 'stat-max-line-length',
      key: 'maxLineLength',
      unit: 'chars',
    },
  },
  {
    label: 'Sentences',
    id: 'stat-sentences',
    key: 'sentences',
    sub: {
      id: 'stat-max-sentence-length',
      key: 'maxSentenceLength',
      unit: 'words',
    },
  },
  {
    label: 'Paragraphs',
    id: 'stat-paragraphs',
    key: 'paragraphs',
    sub: {
      id: 'stat-max-paragraph-length',
      key: 'maxParagraphLength',
      unit: 'sentences',
    },
  },
];

/**
 * Pairing of a DOM id with the {@link TextStats} field written to it,
 * flattened from {@link STAT_TILES} (headline counts and sub-stats
 * alike) so the client script can iterate one list.
 */
export type StatField = Readonly<{
  /**
   * DOM id the client script writes this stat's value to.
   */
  id: string;
  /**
   * {@link TextStats} field this element displays.
   */
  key: keyof TextStats;
}>;

/**
 * Every id/field pairing the client script writes, flattened from
 * {@link STAT_TILES}.
 */
export const STAT_FIELDS: readonly StatField[] = STAT_TILES.flatMap(
  function flattenTile(tile,): readonly StatField[] {
    /**
     * Headline count pairing present on every tile.
     */
    const headline: StatField = {
      id: tile.id,
      key: tile.key,
    };

    return tile.sub === undefined
      ? [headline,]
      : [
        headline,
        {
          id: tile.sub.id,
          key: tile.sub.key,
        },
      ];
  },
);

/**
 * Renders one {@link STAT_TILES} entry as a `<div class="tile">` wrapping
 * a `<dt>` label and one or two `<dd>`s (headline count, optional
 * "longest" sub-stat), each value starting at `0` until the client
 * script computes real stats.
 *
 * @param tile - tile definition to render
 *
 * @returns HTML string for one tile
 */
function renderTile(tile: StatTile,): string {
  /**
   * `<dt>` label plus headline-count `<dd>` present on every tile.
   */
  const children = [
    h(
      {
        tag: 'dt',
        class: 'tile-label',
        text: tile.label,
      },
    ),
    h(
      {
        tag: 'dd',
        class: 'tile-value',
        attrs: { id: tile.id, },
        text: '0',
      },
    ),
  ];

  if (tile.sub !== undefined) {
    children.push(
      h(
        {
          tag: 'dd',
          class: 'tile-sub',
          children: [
            'longest ',
            h(
              {
                tag: 'span',
                attrs: { id: tile.sub.id, },
                text: '0',
              },
            ),
            ` ${tile.sub.unit}`,
          ],
        },
      ),
    );
  }

  return h(
    {
      tag: 'div',
      class: 'tile',
      children,
    },
  );
}

/**
 * Renders the Stats section: a heading and the {@link STAT_TILES}
 * definition list laid out as flex-wrapped tiles, via {@link renderTile}.
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
      class: 'stats-section',
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
            attrs: { class: 'tiles', },
            html: STAT_TILES.map(renderTile,)
              .join('',),
          },
        ),
      ],
    },
  );
}
