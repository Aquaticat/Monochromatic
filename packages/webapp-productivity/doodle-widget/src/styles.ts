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

/** Shared border color for toolbar controls */
const BORDER_COLOR: CssValue = cssOklch({ l: 0.8, c: 0, h: 0, });

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
        'border-block-end-color': BORDER_COLOR,
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
        'border-block-color': BORDER_COLOR,
        'border-inline-style': 'solid',
        'border-inline-color': BORDER_COLOR,
      },
      raw: ';border-block-width:1px;border-inline-width:1px',
    }),

    $({
      rule: '.toolbar button:hover',
      decls: { 'background-color': cssOklch({ l: 0.92, c: 0, h: 0, }), },
    }),

    //region Toggle button group (radio-based exclusive selection)

    $({
      rule: '.toggle-group',
      decls: { display: 'flex', },
    }),

    /** Hide the native radio circle */
    $({
      rule: '.toggle-option input',
      decls: { position: 'absolute', },
      raw: ';appearance:none;width:0;height:0;opacity:0',
    }),

    $({
      rule: '.toggle-option',
      decls: {
        display: 'flex',
        'align-items': 'center',
        'padding-block': BUTTON_PADDING_BLOCK,
        'padding-inline': BUTTON_PADDING_INLINE,
        cursor: 'pointer',
        'background-color': cssOklch({ l: 0.97, c: 0, h: 0, }),
        'border-block-style': 'solid',
        'border-block-color': BORDER_COLOR,
        'border-inline-start-style': 'solid',
        'border-inline-start-color': BORDER_COLOR,
      },
      raw: ';border-block-width:1px;border-inline-start-width:1px;border-inline-end-width:0;border-radius:0',
    }),

    $({
      rule: '.toggle-option:first-child',
      raw: 'border-start-start-radius:0.25rem;border-end-start-radius:0.25rem',
    }),

    $({
      rule: '.toggle-option:last-child',
      raw: 'border-start-end-radius:0.25rem;border-end-end-radius:0.25rem;border-inline-end-width:1px;border-inline-end-style:solid;border-inline-end-color:' + String(BORDER_COLOR),
    }),

    $({
      rule: '.toggle-option:hover',
      decls: { 'background-color': cssOklch({ l: 0.92, c: 0, h: 0, }), },
    }),

    /** Active state driven by native :checked pseudo-class */
    $({
      rule: '.toggle-option:has(input:checked)',
      decls: { 'background-color': cssOklch({ l: 0.82, c: 0, h: 0, }), },
    }),

    $({
      rule: '.toggle-option:has(input:checked):hover',
      decls: { 'background-color': cssOklch({ l: 0.78, c: 0, h: 0, }), },
    }),

    //endregion Toggle button group

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

    //region Text overlay layer

    $({
      rule: '#text-layer',
      decls: {
        position: 'absolute',
        'pointer-events': 'none',
      },
      raw: ';inset-block:0;inset-inline:0',
    }),

    $({
      rule: '.text-input',
      decls: {
        position: 'absolute',
        'background-color': cssOklch({ l: 1, c: 0, h: 0, a: 0.85, }),
        color: cssOklch({ l: 0.3, c: 0, h: 0, }),
        'pointer-events': 'auto',
      },
      raw: ';border:none;outline:none;font-family:system-ui,sans-serif;font-size:1.25rem;line-height:1.4;padding-block:0;padding-inline:0;min-inline-size:8rem',
    }),

    /** Finalized inputs look like plain text */
    $({
      rule: '.text-input:read-only',
      decls: {
        'background-color': 'transparent' as CssValue,
        'pointer-events': 'none',
      },
      raw: ';min-inline-size:0;cursor:default',
    }),

    //endregion Text overlay layer
  ].join('');
}
