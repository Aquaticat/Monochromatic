/**
 * CSS stylesheet for the wc text-stats tool.
 *
 * Single-column layout below the wide-viewport breakpoint, input box beside
 * a scrollable stats/frequency column above it, following the responsive
 * pattern in `packages/webapp-productivity/done/src/client/styles-layout.ts`.
 * Palette lives in {@link renderRootColors} and {@link renderDarkColors}
 * (`./styles-colors.ts`).
 */
import {
  cssCommaList,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

import {
  renderDarkColors,
  renderRootColors,
} from './styles-colors.ts';

/**
 * Viewport width, in rem, above which the input and results panels sit
 * side by side instead of stacked.
 */
const WIDE_VIEWPORT_REM = 48;

/**
 * Generates the complete CSS stylesheet for the wc tool, using
 * {@link renderRootColors}, {@link renderDarkColors}, and
 * {@link WIDE_VIEWPORT_REM} for palette and layout breakpoint.
 *
 * @returns minified CSS string
 *
 * @example
 * ```ts
 * const css = renderStyles();
 * ```
 */
export function renderStyles(): string {
  return [
    renderRootColors(),
    renderDarkColors(),

    $(
      {
        rule: '*, *::before, *::after',
        decls: {
          'box-sizing': 'border-box',
          'margin-block': cssNum(0,),
          'margin-inline': cssNum(0,),
        },
      },
    ),

    $(
      {
        rule: 'body',
        decls: {
          'font-family': cssCommaList(
            [
              'system-ui',
              'sans-serif',
            ],
          ),
          color: cssVar('color-fg',),
          'background-color': cssVar('color-bg',),
          'padding-block': cssRem(2,),
          'padding-inline': cssRem(2,),
          'max-inline-size': cssRem(10 * ((2 * 2) + 2),),
          'margin-inline': 'auto',
          'line-height': cssNum(1 + (1 / 2),),
        },
      },
    ),

    $(
      {
        rule: 'h1',
        decls: {
          'font-size': cssRem(1 + (1 / 2),),
          'margin-block-end': cssRem(1 / 2,),
        },
      },
    ),

    $(
      {
        rule: '.description',
        decls: {
          'margin-block-end': cssRem(1 + (1 / 2),),
          color: cssVar('color-muted',),
        },
      },
    ),

    $(
      {
        rule: '.layout',
        decls: {
          display: 'flex',
          'flex-direction': 'column',
          gap: cssRem(2,),
        },
      },
    ),

    $(
      {
        at: 'media',
        params: `(min-width: ${cssRem(WIDE_VIEWPORT_REM,)})`,
        children: [
          $(
            {
              rule: '.layout',
              decls: { 'flex-direction': 'row', },
            },
          ),
          $(
            {
              rule: '.input-panel, .results-panel',
              decls: {
                'flex-basis': cssPercent(100 / 2,),
                'min-inline-size': cssNum(0,),
              },
            },
          ),
          $(
            {
              rule: '.results-panel',
              decls: {
                'max-block-size': cssRem(10 * ((2 * 2) + 2),),
                'overflow-y': 'auto',
              },
            },
          ),
        ],
      },
    ),

    $(
      {
        rule: '.input-panel label',
        decls: {
          display: 'block',
          'margin-block-end': cssRem(1 / 2,),
          'font-weight': cssNum(1 + (1 / 2)
            + (1 / 2)
            + (1 / 2),),
        },
      },
    ),

    $(
      {
        rule: '#wc-input',
        decls: {
          'inline-size': cssPercent(100,),
          'min-block-size': cssRem(2 * (2 * 2)
            * 2,),
          'font-family': 'inherit',
          'font-size': 'inherit',
          color: 'inherit',
          'background-color': 'inherit',
          'padding-block': cssRem(1 / 2,),
          'padding-inline': cssRem(1 / 2,),
          resize: 'vertical',
        },
      },
    ),

    $(
      {
        rule: '#wc-input::placeholder',
        decls: { color: cssVar('color-placeholder',), },
      },
    ),

    $(
      {
        rule: '.results-panel section',
        decls: { 'margin-block-end': cssRem(1 + (1 / 2),), },
      },
    ),

    $(
      {
        rule: '.results-panel h2',
        decls: {
          'font-size': cssRem(1 + (1 / 2
            / 2),),
          'margin-block-end': cssRem(1 / 2,),
        },
      },
    ),

    $(
      {
        rule: '.stats',
        decls: {
          display: 'flex',
          'flex-direction': 'column',
          gap: cssRem(1 / 2
            / 2,),
        },
      },
    ),

    $(
      {
        rule: '.stat-row',
        decls: {
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'baseline',
          gap: cssRem(1,),
        },
      },
    ),

    $(
      {
        rule: '.stats dt',
        decls: { color: cssVar('color-muted',), },
      },
    ),

    $(
      {
        rule: '.stats dd',
        decls: {
          'text-align': 'end',
          'white-space': 'nowrap',
          'font-variant-numeric': 'tabular-nums',
        },
      },
    ),

    $(
      {
        rule: '.frequency',
        decls: {
          'inline-size': cssPercent(100,),
          'border-collapse': 'collapse',
        },
      },
    ),

    $(
      {
        rule: '.frequency th, .frequency td',
        decls: {
          'text-align': 'start',
          'padding-block': cssRem(1 / 2
            / 2,),
          'padding-inline': cssRem(1 / 2,),
          'border-block-end-style': 'solid',
          'border-block-end-width': cssRem(1 / 16,),
          'border-block-end-color': cssVar('color-divider',),
        },
      },
    ),

    $(
      {
        rule: '.frequency th:nth-child(n+2), .frequency td:nth-child(n+2)',
        decls: {
          'text-align': 'end',
          'font-variant-numeric': 'tabular-nums',
        },
      },
    ),

    $(
      {
        rule: '.frequency-empty',
        decls: {
          color: cssVar('color-muted',),
          'text-align': 'center',
        },
      },
    ),
  ]
    .join('',);
}
