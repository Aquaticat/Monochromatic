/**
 * Reset, page scaffold, masthead, and input-panel styles for the wc
 * text-stats tool.
 *
 * The page is a viewport-filling flex column (`min-block-size: 100dvh`
 * on `.page`, not on the textarea) so an empty page shows no scrollbar:
 * the layout row flexes to fill exactly the remaining height and the
 * textarea stretches inside it. Growth beyond the viewport comes from
 * the client script's auto-grow, which raises the textarea's
 * `min-block-size` to its scroll height.
 *
 * Flexbox only; CSS grid is not allowed in this package.
 */
import {
  cssCommaList,
  cssNum,
  cssRem,
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

/**
 * Viewport width, in rem, above which the input and results panels sit
 * side by side instead of stacked: the 60ch input minimum plus a usable
 * results column no longer fit below this.
 */
export const WIDE_VIEWPORT_REM = 64;

/**
 * Base spacing unit (rem) the scaffold's paddings and gaps derive from.
 */
const SPACE = 1 + (1 / 2);

/**
 * Hairline border width in rem (one device pixel at default zoom).
 */
export const HAIRLINE = 1 / 16;

/**
 * Masthead title weight.
 */
const WEIGHT_TITLE = 700;

/**
 * Input label weight.
 */
const WEIGHT_LABEL = 600;

/**
 * Flex-grow factor that lets the input panel absorb all free inline
 * space (up to its 90ch cap) before the results panel starts growing.
 */
const INPUT_GROW_FACTOR = 999;

/**
 * Results panel preferred inline size in rem.
 */
const RESULTS_BASIS_REM = 24;

/**
 * Results panel maximum inline size in rem.
 */
const RESULTS_MAX_REM = 40;

/**
 * Empty-textarea minimum block size in rem, a floor for when the
 * flex-stretch has little room (stacked narrow layout).
 */
const INPUT_MIN_BLOCK_REM = 16;

/**
 * Generates reset, body, page, masthead, and input-panel rules.
 *
 * @returns minified CSS string
 *
 * @example
 * ```ts
 * const css = renderLayoutStyles();
 * ```
 */
export function renderLayoutStyles(): string {
  return [
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
              "'Inter'",
              'system-ui',
              'sans-serif',
            ],
          ),
          color: cssVar('color-fg',),
          'background-color': cssVar('color-bg',),
          'line-height': cssNum(1 + (1 / 2),),
        },
      },
    ),

    $(
      {
        rule: '.page',
        decls: {
          'min-block-size': '100dvh',
          display: 'flex',
          'flex-direction': 'column',
          gap: cssRem(SPACE,),
          'padding-block': cssRem(SPACE,),
          'padding-inline': cssRem(SPACE,),
        },
      },
    ),

    $(
      {
        rule: 'h1',
        decls: {
          'font-size': cssRem(1 + (1 / 2),),
          'font-weight': cssNum(WEIGHT_TITLE,),
          'line-height': cssNum(1 + (1 / 4),),
        },
      },
    ),

    $(
      {
        rule: '.description',
        decls: {
          color: cssVar('color-muted',),
          'max-inline-size': '60ch',
          'margin-block-start': cssRem(1 / 4,),
        },
      },
    ),

    $(
      {
        rule: '.layout',
        decls: {
          display: 'flex',
          'flex-direction': 'column',
          gap: cssRem(SPACE,),
          'flex-grow': cssNum(1,),
        },
      },
    ),

    $(
      {
        rule: '.input-panel',
        decls: {
          display: 'flex',
          'flex-direction': 'column',
          gap: cssRem(1 / 2,),
          'min-inline-size': 'min(60ch, 100%)',
          'max-inline-size': '90ch',
        },
      },
    ),

    $(
      {
        rule: '.input-panel label',
        decls: {
          'font-size': cssRem(1 - (1 / 8),),
          'font-weight': cssNum(WEIGHT_LABEL,),
        },
      },
    ),

    $(
      {
        rule: '#wc-input',
        decls: {
          'inline-size': '100%',
          'flex-grow': cssNum(1,),
          'min-block-size': cssRem(INPUT_MIN_BLOCK_REM,),
          'font-family': 'inherit',
          'font-size': 'inherit',
          'line-height': 'inherit',
          color: 'inherit',
          'background-color': cssVar('color-bg',),
          'border-width': cssRem(HAIRLINE,),
          'border-style': 'solid',
          'border-color': cssVar('color-border-strong',),
          'border-radius': cssRem(1 / 2,),
          'padding-block': cssRem(3 / 4,),
          'padding-inline': cssRem(1 - (1 / 8),),
          resize: 'none',
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
        rule: '#wc-input:focus-visible',
        decls: {
          'outline-width': cssRem(1 / 8,),
          'outline-style': 'solid',
          'outline-color': cssVar('color-fg-strong',),
          'outline-offset': cssRem(1 / 8,),
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
              decls: {
                'flex-direction': 'row',
                'justify-content': 'center',
                gap: cssRem(SPACE + (1 / 2),),
              },
            },
          ),
          $(
            {
              rule: '.input-panel',
              decls: {
                'flex-grow': cssNum(INPUT_GROW_FACTOR,),
                'flex-shrink': cssNum(1,),
                'flex-basis': cssNum(0,),
              },
            },
          ),
          $(
            {
              rule: '.results-panel',
              decls: {
                'flex-grow': cssNum(1,),
                'flex-shrink': cssNum(1,),
                'flex-basis': cssRem(RESULTS_BASIS_REM,),
                'min-inline-size': cssNum(0,),
                'max-inline-size': cssRem(RESULTS_MAX_REM,),
                position: 'sticky',
                'inset-block-start': cssRem(SPACE,),
                'align-self': 'flex-start',
              },
            },
          ),
        ],
      },
    ),
  ]
    .join('',);
}
