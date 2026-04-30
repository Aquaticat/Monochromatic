/**
 * CSS stylesheet for paper2vn.
 *
 * Uses h-css for type-checked property names and values. Tokens come
 * from `./styles/tokens.ts`. Layout is screen-as-flex-column with
 * `[hidden]` toggling between screens; data attributes drive state
 * variants instead of BEM-style class modifiers.
 */
import {
  cssCalc,
  cssCommaList,
  cssCompounded,
  cssNum,
  cssOklch,
  cssRem,
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

import {
  FONT_WEIGHT_BOLD,
  FULL_DVB,
  FULL_DVI,
  FULL_PERCENT,
  HALF_DVB,
  RADIUS_LARGE,
  RADIUS_SMALL,
  SHADOW_OFFSET,
  SPACE_HALF,
  SPACE_ONE,
  SPACE_QUARTER,
  SPACE_THREE_QUARTERS,
  SPACE_TWO,
  TOUCH_TARGET,
} from './styles/tokens.ts';

/**
 * Generates the complete stylesheet.
 *
 * @returns minified CSS string
 */
export function renderStyles(): string {
  return [
    $({
      rule: ':root',
      decls: {
        '--bg': cssOklch({
          l: 0.97,
          c: 0.01,
          h: 50,
        },),
        '--bg-elevated': cssOklch({
          l: 1,
          c: 0,
          h: 0,
        },),
        '--fg': cssOklch({
          l: 0.2,
          c: 0.02,
          h: 280,
        },),
        '--fg-muted': cssOklch({
          l: 0.45,
          c: 0.02,
          h: 280,
        },),
        '--accent': cssOklch({
          l: 0.6,
          c: 0.18,
          h: 350,
        },),
        '--accent-fg': cssOklch({
          l: 0.99,
          c: 0.01,
          h: 350,
        },),
        '--border': cssOklch({
          l: 0.85,
          c: 0.02,
          h: 50,
        },),
        '--shadow': cssOklch({
          l: 0.2,
          c: 0.02,
          h: 280,
          a: 0.16,
        },),
        '--bg-board': cssOklch({
          l: 0.32,
          c: 0.04,
          h: 165,
        },),
        '--font-scale': cssNum(1,),
        'color-scheme': cssCompounded([
          'light',
          'dark',
        ],),
        'font-family': cssCommaList([
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],),
      },
    },),
    $({
      rule: '@media (prefers-color-scheme: dark)',
      children: [
        $({
          rule: ':root',
          decls: {
            '--bg': cssOklch({
              l: 0.16,
              c: 0.01,
              h: 280,
            },),
            '--bg-elevated': cssOklch({
              l: 0.22,
              c: 0.02,
              h: 280,
            },),
            '--fg': cssOklch({
              l: 0.95,
              c: 0.01,
              h: 50,
            },),
            '--fg-muted': cssOklch({
              l: 0.65,
              c: 0.02,
              h: 50,
            },),
            '--border': cssOklch({
              l: 0.32,
              c: 0.02,
              h: 280,
            },),
            '--shadow': cssOklch({
              l: 0,
              c: 0,
              h: 0,
              a: 0.45,
            },),
          },
        },),
      ],
    },),
    $({
      rule: '*, *::before, *::after',
      decls: {
        'box-sizing': 'border-box',
        'margin-block-start': cssNum(0,),
        'margin-block-end': cssNum(0,),
        'margin-inline-start': cssNum(0,),
        'margin-inline-end': cssNum(0,),
        'padding-block-start': cssNum(0,),
        'padding-block-end': cssNum(0,),
        'padding-inline-start': cssNum(0,),
        'padding-inline-end': cssNum(0,),
      },
    },),
    $({
      rule: 'html, body',
      decls: {
        'block-size': FULL_PERCENT,
        'inline-size': FULL_PERCENT,
        'background-color': cssVar('bg',),
        color: cssVar('fg',),
        'font-size': cssCalc(`1rem * ${cssVar('font-scale',)}`,),
      },
    },),
    $({
      rule: 'body',
      decls: {
        'line-height': cssNum(1.5,),
      },
    },),
    $({
      rule: 'main#app',
      decls: {
        display: 'block',
        'min-block-size': FULL_DVB,
        'min-inline-size': FULL_DVI,
      },
    },),
    $({
      rule: 'button, input, select, textarea',
      decls: {
        font: 'inherit',
        color: 'inherit',
      },
    },),
    $({
      rule: 'button',
      decls: {
        cursor: 'pointer',
        'min-block-size': TOUCH_TARGET,
        'min-inline-size': TOUCH_TARGET,
        'background-color': cssVar('bg-elevated',),
        'border-block-start-width': cssRem(1 / 16,),
        'border-block-end-width': cssRem(1 / 16,),
        'border-inline-start-width': cssRem(1 / 16,),
        'border-inline-end-width': cssRem(1 / 16,),
        'border-block-start-style': 'solid',
        'border-block-end-style': 'solid',
        'border-inline-start-style': 'solid',
        'border-inline-end-style': 'solid',
        'border-block-start-color': cssVar('border',),
        'border-block-end-color': cssVar('border',),
        'border-inline-start-color': cssVar('border',),
        'border-inline-end-color': cssVar('border',),
        'border-start-start-radius': RADIUS_SMALL,
        'border-start-end-radius': RADIUS_SMALL,
        'border-end-start-radius': RADIUS_SMALL,
        'border-end-end-radius': RADIUS_SMALL,
        'padding-block': SPACE_HALF,
        'padding-inline': SPACE_ONE,
      },
    },),
    $({
      rule: 'button[data-variant="primary"]',
      decls: {
        'background-color': cssVar('accent',),
        color: cssVar('accent-fg',),
        'border-block-start-color': cssVar('accent',),
        'border-block-end-color': cssVar('accent',),
        'border-inline-start-color': cssVar('accent',),
        'border-inline-end-color': cssVar('accent',),
        'font-weight': FONT_WEIGHT_BOLD,
      },
    },),
    $({
      rule: 'button[data-variant="ghost"]',
      decls: {
        'background-color': 'transparent',
        'border-block-start-color': 'transparent',
        'border-block-end-color': 'transparent',
        'border-inline-start-color': 'transparent',
        'border-inline-end-color': 'transparent',
      },
    },),
    $({
      rule: ':focus-visible',
      decls: {
        outline: `${cssRem(1 / 8,)} solid ${cssVar('accent',)}`,
        'outline-offset': cssRem(1 / 8,),
      },
    },),
    $({
      rule: '.screen',
      decls: {
        display: 'flex',
        'flex-direction': 'column',
        'min-block-size': FULL_DVB,
        'padding-block': SPACE_TWO,
        'padding-inline': SPACE_TWO,
        gap: SPACE_ONE,
        'max-inline-size': cssRem(48,),
        'margin-inline': 'auto',
      },
    },),
    $({
      rule: '.screen[data-screen="lecture"]',
      decls: {
        'max-inline-size': 'none',
        'padding-block': cssNum(0,),
        'padding-inline': cssNum(0,),
      },
    },),
    $({
      rule: '.h1, h1',
      decls: {
        'font-size': cssRem(2,),
        'font-weight': FONT_WEIGHT_BOLD,
        'line-height': cssNum(1.2,),
      },
    },),
    $({
      rule: '.h2, h2',
      decls: {
        'font-size': cssRem(1.5,),
        'font-weight': FONT_WEIGHT_BOLD,
        'line-height': cssNum(1.3,),
      },
    },),
    $({
      rule: '.menu',
      decls: {
        display: 'flex',
        'flex-direction': 'column',
        gap: SPACE_HALF,
        'padding-block': SPACE_ONE,
        'padding-inline': SPACE_ONE,
        'background-color': cssVar('bg-elevated',),
        'border-start-start-radius': RADIUS_LARGE,
        'border-start-end-radius': RADIUS_LARGE,
        'border-end-start-radius': RADIUS_LARGE,
        'border-end-end-radius': RADIUS_LARGE,
        'box-shadow': cssCommaList([
          `0 ${SHADOW_OFFSET} ${cssRem(1,)} ${cssVar('shadow',)}`,
        ],),
      },
    },),
    $({
      rule: '.menu button',
      decls: {
        'text-align': 'start',
      },
    },),
    $({
      rule: '.field',
      decls: {
        display: 'flex',
        'flex-direction': 'column',
        gap: SPACE_QUARTER,
      },
    },),
    $({
      rule: '.field > label',
      decls: {
        color: cssVar('fg-muted',),
        'font-size': cssRem(0.875,),
      },
    },),
    $({
      rule: 'input, select, textarea',
      decls: {
        'background-color': cssVar('bg-elevated',),
        color: cssVar('fg',),
        'min-block-size': TOUCH_TARGET,
        'padding-block': SPACE_HALF,
        'padding-inline': SPACE_THREE_QUARTERS,
        'border-block-start-width': cssRem(1 / 16,),
        'border-block-end-width': cssRem(1 / 16,),
        'border-inline-start-width': cssRem(1 / 16,),
        'border-inline-end-width': cssRem(1 / 16,),
        'border-block-start-style': 'solid',
        'border-block-end-style': 'solid',
        'border-inline-start-style': 'solid',
        'border-inline-end-style': 'solid',
        'border-block-start-color': cssVar('border',),
        'border-block-end-color': cssVar('border',),
        'border-inline-start-color': cssVar('border',),
        'border-inline-end-color': cssVar('border',),
        'border-start-start-radius': RADIUS_SMALL,
        'border-start-end-radius': RADIUS_SMALL,
        'border-end-start-radius': RADIUS_SMALL,
        'border-end-end-radius': RADIUS_SMALL,
      },
    },),
    $({
      rule: 'textarea',
      decls: {
        'min-block-size': cssRem(8,),
        'font-family': 'inherit',
      },
    },),
    $({
      rule: '.row',
      decls: {
        display: 'flex',
        'flex-wrap': 'wrap',
        gap: SPACE_HALF,
        'align-items': 'center',
      },
    },),
    $({
      rule: '.muted',
      decls: {
        color: cssVar('fg-muted',),
      },
    },),
    $({
      rule: '.error',
      decls: {
        color: cssOklch({
          l: 0.55,
          c: 0.18,
          h: 28,
        },),
      },
    },),
    $({
      rule: '.stage',
      decls: {
        position: 'relative',
        'block-size': FULL_DVB,
        'inline-size': FULL_DVI,
        overflow: 'hidden',
        'background-color': cssVar('bg-board',),
      },
    },),
    $({
      rule: '.stage-bg',
      decls: {
        position: 'absolute',
        'inset-block-start': cssNum(0,),
        'inset-block-end': cssNum(0,),
        'inset-inline-start': cssNum(0,),
        'inset-inline-end': cssNum(0,),
        'background-size': 'cover',
        'background-position': 'center',
      },
    },),
    $({
      rule: '.stage-character',
      decls: {
        position: 'absolute',
        'inset-block-end': cssNum(0,),
        'inset-inline-start': FULL_PERCENT,
        transform: cssCompounded(['translate(-50%, 0)',],),
        'block-size': cssCalc(`${FULL_DVB} - ${cssRem(14,)}`,),
        'aspect-ratio': cssCompounded([
          '240',
          '/',
          '480',
        ],),
      },
    },),
    $({
      rule: '.stage-character img',
      decls: {
        'block-size': FULL_PERCENT,
        'inline-size': 'auto',
      },
    },),
    $({
      rule: '.stage-controls',
      decls: {
        position: 'absolute',
        'inset-block-start': SPACE_ONE,
        'inset-inline-end': SPACE_ONE,
        display: 'flex',
        gap: SPACE_HALF,
      },
    },),
    $({
      rule: '.stage-dialogue',
      decls: {
        position: 'absolute',
        'inset-inline-start': SPACE_ONE,
        'inset-inline-end': SPACE_ONE,
        'inset-block-end': SPACE_ONE,
        'background-color': cssVar('bg-elevated',),
        'border-start-start-radius': RADIUS_LARGE,
        'border-start-end-radius': RADIUS_LARGE,
        'border-end-start-radius': RADIUS_LARGE,
        'border-end-end-radius': RADIUS_LARGE,
        'padding-block': SPACE_ONE,
        'padding-inline': SPACE_ONE,
        'max-block-size': HALF_DVB,
        'overflow-y': 'auto',
        'box-shadow': cssCommaList([
          `0 ${SHADOW_OFFSET} ${cssRem(1,)} ${cssVar('shadow',)}`,
        ],),
      },
    },),
    $({
      rule: '.stage-dialogue header',
      decls: {
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        'margin-block-end': SPACE_HALF,
      },
    },),
    $({
      rule: '.speaker-name',
      decls: {
        'font-weight': FONT_WEIGHT_BOLD,
        color: cssVar('accent',),
      },
    },),
    $({
      rule: '.dialogue-text',
      decls: {
        'white-space': 'pre-wrap',
        'overflow-wrap': 'anywhere',
      },
    },),
    $({
      rule: '.chapter-card',
      decls: {
        position: 'absolute',
        'inset-block-start': cssNum(0,),
        'inset-block-end': cssNum(0,),
        'inset-inline-start': cssNum(0,),
        'inset-inline-end': cssNum(0,),
        display: 'grid',
        'place-items': 'center',
        'background-color': cssOklch({
          l: 0,
          c: 0,
          h: 0,
          a: 0.5,
        },),
        color: cssOklch({
          l: 0.99,
          c: 0,
          h: 0,
        },),
        'text-align': 'center',
        'padding-block': SPACE_TWO,
        'padding-inline': SPACE_TWO,
      },
    },),
    $({
      rule: '.chapter-card h2',
      decls: {
        'font-size': cssRem(2.5,),
      },
    },),
    $({
      rule: '.log-pane',
      decls: {
        position: 'fixed',
        'inset-block-start': cssNum(0,),
        'inset-block-end': cssNum(0,),
        'inset-inline-start': cssNum(0,),
        'inset-inline-end': cssNum(0,),
        'background-color': cssVar('bg',),
        'overflow-y': 'auto',
        'padding-block': SPACE_TWO,
        'padding-inline': SPACE_TWO,
        'z-index': cssNum(10,),
      },
    },),
    $({
      rule: '.log-entry',
      decls: {
        'border-inline-start-width': cssRem(1 / 4,),
        'border-inline-start-style': 'solid',
        'border-inline-start-color': cssVar('accent',),
        'padding-block': SPACE_HALF,
        'padding-inline-start': SPACE_THREE_QUARTERS,
        'margin-block-end': SPACE_THREE_QUARTERS,
      },
    },),
    $({
      rule: '.toolbar',
      decls: {
        display: 'flex',
        gap: SPACE_HALF,
      },
    },),
    $({
      rule: '.toolbar button',
      decls: {
        'min-inline-size': TOUCH_TARGET,
      },
    },),
    /**
     * `[hidden]` must override layout-specific `display` declarations
     * (`.chapter-card` uses `display: grid`, dialogue uses `display:
     * flex`, etc.). Placed last so equal-specificity rules order-win.
     */
    $({
      rule: '[hidden]',
      decls: {
        display: 'none',
      },
    },),
  ]
    .join('\n',);
}
