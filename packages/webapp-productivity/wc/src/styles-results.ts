/**
 * Results-panel styles for the wc text-stats tool: the six stat tiles
 * and the Frequency ARIA table.
 *
 * Tiles are flex-wrapped (no CSS grid). Frequency rows are flex rows so
 * per-row `content-visibility: auto` takes effect (it is ignored on
 * internal table boxes), keeping unbounded row counts cheap to render.
 * Number columns align purely through Inter's tabular numerals plus
 * figure-space padding done by the client script; no column widths are
 * managed in CSS. Each row's bar sits in a fixed-width end-of-row track
 * so bar lengths stay comparable across rows, and carries a mid-stop
 * border so even a minimum-count bar stays visible.
 */
import {
  cssCompounded,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

import { HAIRLINE, } from './styles-layout.ts';

/**
 * Tile headline-number weight, heavier than body but below bold so the
 * variable font renders it crisply at display size.
 */
const WEIGHT_VALUE = 650;

/**
 * Section-heading weight.
 */
const WEIGHT_HEADING = 600;

/**
 * Small-text size in rem shared by tile labels, tile sub-stats, and the
 * frequency header row.
 */
const SMALL_TEXT_REM = 3 / 4;

/**
 * Tile headline-number size in rem.
 */
const VALUE_SIZE_REM = 1 + (3 / 4);

/**
 * Fixed inline size in rem of every frequency bar track; equal tracks
 * keep bar lengths comparable across rows.
 */
const BAR_TRACK_REM = 7;

/**
 * Estimated frequency-row block size in rem for
 * `contain-intrinsic-block-size`, so skipped rows keep the scrollbar
 * stable.
 */
const ROW_INTRINSIC_REM = 2 + (1 / 4);

/**
 * Full-length percentage.
 */
const FULL_PERCENT = 100;

/**
 * Generates results-panel, tiles, and frequency rules.
 *
 * @returns minified CSS string
 *
 * @example
 * ```ts
 * const css = renderResultsStyles();
 * ```
 */
export function renderResultsStyles(): string {
  return [
    $(
      {
        rule: '.results-panel h2',
        decls: {
          'font-size': cssRem(1 - (1 / 8),),
          'font-weight': cssNum(WEIGHT_HEADING,),
          color: cssVar('color-muted',),
          'margin-block-end': cssRem(3 / 4,),
        },
      },
    ),

    $(
      {
        rule: '.stats-section',
        decls: { 'margin-block-end': cssRem(2,), },
      },
    ),

    $(
      {
        rule: '.tiles',
        decls: {
          display: 'flex',
          'flex-wrap': 'wrap',
          gap: cssRem(3 / 4,),
        },
      },
    ),

    $(
      {
        rule: '.tile',
        decls: {
          'flex-grow': cssNum(1,),
          'flex-shrink': cssNum(1,),
          'flex-basis': cssRem((2 * 2 * 2)
            + (1 / 2),),
          display: 'flex',
          'flex-direction': 'column',
          gap: cssRem(1 / 4,),
          'padding-block': cssRem(1 - (1 / 8),),
          'padding-inline': cssRem(1,),
          'border-radius': cssRem(1 / 2,),
          'background-color': cssVar('color-surface',),
        },
      },
    ),

    $(
      {
        rule: '.tile-label',
        decls: { 'font-size': cssRem(SMALL_TEXT_REM,), },
      },
    ),

    $(
      {
        rule: '.tile-value',
        decls: {
          'font-size': cssRem(VALUE_SIZE_REM,),
          'font-weight': cssNum(WEIGHT_VALUE,),
          'line-height': cssNum(1 + (1 / 8),),
          color: cssVar('color-fg-strong',),
        },
      },
    ),

    $(
      {
        rule: '.tile-sub',
        decls: { 'font-size': cssRem(SMALL_TEXT_REM,), },
      },
    ),

    $(
      {
        rule: '.frequency',
        decls: { 'font-variant-numeric': 'tabular-nums', },
      },
    ),

    $(
      {
        rule: '.frequency-row',
        decls: {
          display: 'flex',
          gap: cssRem(3 / 4,),
          'align-items': 'baseline',
          'padding-block': cssRem(1 / 2,),
          'border-block-end-width': cssRem(HAIRLINE,),
          'border-block-end-style': 'solid',
          'border-block-end-color': cssVar('color-border-subtle',),
        },
      },
    ),

    $(
      {
        rule: '.frequency-head',
        decls: {
          'font-size': cssRem(SMALL_TEXT_REM,),
          color: cssVar('color-muted',),
          'border-block-end-color': cssVar('color-border-strong',),
        },
      },
    ),

    $(
      {
        rule: '#frequency-body .frequency-row',
        decls: {
          'content-visibility': 'auto',
          'contain-intrinsic-block-size': cssCompounded(
            [
              'auto',
              cssRem(ROW_INTRINSIC_REM,),
            ],
          ),
        },
      },
    ),

    $(
      {
        rule: '.freq-count, .freq-pct',
        decls: { 'flex-shrink': cssNum(0,), },
      },
    ),

    $(
      {
        rule: '.freq-word',
        decls: {
          'flex-grow': cssNum(1,),
          'flex-shrink': cssNum(1,),
          'min-inline-size': cssNum(0,),
          'overflow-wrap': 'anywhere',
        },
      },
    ),

    $(
      {
        rule: '.freq-bar-track',
        decls: {
          'flex-grow': cssNum(0,),
          'flex-shrink': cssNum(0,),
          'flex-basis': cssRem(BAR_TRACK_REM,),
          'align-self': 'center',
          'block-size': cssRem(1 / 2
            + (1 / 8),),
        },
      },
    ),

    $(
      {
        rule: '.freq-bar',
        decls: {
          display: 'block',
          'block-size': cssPercent(FULL_PERCENT,),
          'inline-size': cssVar('bar',),
          'min-inline-size': cssRem(1 / 4,),
          'background-color': cssVar('color-bar',),
          'border-width': cssRem(HAIRLINE,),
          'border-style': 'solid',
          'border-color': cssVar('color-border-strong',),
          'border-start-end-radius': cssRem(1 / 4,),
          'border-end-end-radius': cssRem(1 / 4,),
        },
      },
    ),

    $(
      {
        rule: '.frequency-empty',
        decls: { color: cssVar('color-muted',), },
      },
    ),
  ]
    .join('',);
}
