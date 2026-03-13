/**
 * CSS styles for the doodle widget.
 *
 * Uses h-css for type-safe CSS generation with strict property validation.
 * Raw CSS strings handle px values and properties outside the strict type system.
 */
import {
  type CssValue,
  $,
  cssDvb,
  cssNum,
  cssOklch,
  cssPercent,
  cssRem,
} from '@monochromatic-dev/module-es/h-css';

//region Design tokens

/** Whole unit (100 for viewport/percent) */
const WHOLE = 100;

/** Bold font weight value */
const BOLD = 700;

/** 1/2 */
const HALF = 1 / 2;

/** 1/4 */
const QUARTER = HALF / 2;

/** 3/4 */
const THREE_QUARTERS = HALF + QUARTER;

/** 3/8 */
const THREE_EIGHTHS = THREE_QUARTERS / 2;

/** Full dynamic viewport block size */
const FULL_DVB: CssValue = cssDvb(WHOLE);

/** Full percentage (100%) */
const FULL_PERCENT: CssValue = cssPercent(WHOLE);

/** Bold font weight */
const FONT_WEIGHT_BOLD: CssValue = cssNum(BOLD);

/** Standard toolbar gap between items */
const TOOLBAR_GAP: CssValue = cssRem(THREE_QUARTERS);

/** Vertical padding for toolbar */
const TOOLBAR_PADDING_BLOCK: CssValue = cssRem(HALF);

/** Horizontal padding for toolbar */
const TOOLBAR_PADDING_INLINE: CssValue = cssRem(1);

/** Vertical padding for buttons */
const BUTTON_PADDING_BLOCK: CssValue = cssRem(THREE_EIGHTHS);

/** Horizontal padding for buttons */
const BUTTON_PADDING_INLINE: CssValue = cssRem(THREE_QUARTERS);

/** Button corner radius */
const BUTTON_RADIUS: CssValue = cssRem(QUARTER);

//endregion Design tokens

/**
 * Generates the complete CSS stylesheet for the doodle widget.
 *
 * @returns minified CSS string
 */
export function renderStyles(): string {
  return [
    $({ rule: '*, *::before, *::after', raw: 'box-sizing:border-box;margin-block:0;margin-inline:0', }),

    $({
      rule: '#app',
      decls: { display: 'flex', 'flex-direction': 'column', 'block-size': FULL_DVB, },
    }),

    $({
      rule: '.toolbar',
      decls: {
        display: 'flex',
        'align-items': 'center',
        gap: TOOLBAR_GAP,
        'padding-block': TOOLBAR_PADDING_BLOCK,
        'padding-inline': TOOLBAR_PADDING_INLINE,
        'background-color': cssOklch({ l: 0.95, c: 0, h: 0, }),
        'border-block-end-style': 'solid',
        'border-block-end-color': cssOklch({ l: 0.8, c: 0, h: 0, }),
      },
      raw: ';border-block-end-width:1px',
    }),

    $({
      rule: '.toolbar-title',
      decls: { 'font-weight': FONT_WEIGHT_BOLD, },
    }),

    $({
      rule: '.toolbar button',
      decls: {
        'padding-block': BUTTON_PADDING_BLOCK,
        'padding-inline': BUTTON_PADDING_INLINE,
        cursor: 'pointer',
        'border-radius': BUTTON_RADIUS,
        'background-color': cssOklch({ l: 0.97, c: 0, h: 0, }),
        'border-block-style': 'solid',
        'border-block-color': cssOklch({ l: 0.8, c: 0, h: 0, }),
        'border-inline-style': 'solid',
        'border-inline-color': cssOklch({ l: 0.8, c: 0, h: 0, }),
      },
      raw: ';border-block-width:1px;border-inline-width:1px',
    }),

    $({
      rule: '.toolbar button:hover',
      decls: { 'background-color': cssOklch({ l: 0.92, c: 0, h: 0, }), },
    }),

    $({
      rule: '#canvas-container',
      decls: {
        position: 'relative',
        'flex-grow': cssNum(1),
        'overflow-x': 'hidden',
        'overflow-y': 'hidden',
        'background-color': cssOklch({ l: 1, c: 0, h: 0, }),
      },
    }),

    $({
      rule: '#draw-canvas',
      decls: {
        position: 'absolute',
        display: 'block',
        cursor: 'crosshair',
        'touch-action': 'none',
      },
      raw: ';inset-block:0;inset-inline:0',
    }),

    $({
      rule: '#svg-overlay',
      decls: {
        position: 'absolute',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'pointer-events': 'none',
      },
      raw: ';inset-block:0;inset-inline:0',
    }),

    $({
      rule: '#svg-overlay > svg',
      decls: {
        'max-inline-size': FULL_PERCENT,
        'max-block-size': FULL_PERCENT,
      },
    }),
  ].join('');
}
