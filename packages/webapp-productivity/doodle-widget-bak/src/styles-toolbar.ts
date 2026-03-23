/**
 * Toolbar and button CSS rules for the doodle widget.
 *
 * Covers the top toolbar bar, title, and standalone button styling.
 * Control-specific rules (export group, draw settings) are composed
 * from {@link renderToolbarControlStyles}, and toggle-group rules
 * from {@link renderToggleGroupStyles}.
 */
import {
  $,
  cssOklch,
  cssRem,
} from '@monochromatic-dev/module-es/h-css';
import {
  BORDER_COLOR,
  BORDER_WIDTH,
  BUTTON_PADDING_BLOCK,
  BUTTON_PADDING_INLINE,
  BUTTON_RADIUS,
  FONT_WEIGHT_BOLD,
  TOOLBAR_GAP,
  TOOLBAR_PADDING_BLOCK,
  TOOLBAR_PADDING_INLINE,
} from './style-tokens.ts';
import { renderToolbarControlStyles, } from './styles-toolbar-controls.ts';
import { renderToggleGroupStyles, } from './styles-toolbar-toggle.ts';

/**
 * Generates CSS rules for the toolbar, buttons, and composed sub-groups.
 *
 * @returns array of minified CSS rule strings
 *
 * @example
 * ```ts
 * const css = renderToolbarStyles().join('');
 * ```
 */
export function renderToolbarStyles(): string[] {
  return [
    $({
      rule: '.toolbar',
      decls: {
        display: 'flex',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        gap: TOOLBAR_GAP,
        'padding-block': TOOLBAR_PADDING_BLOCK,
        'padding-inline': TOOLBAR_PADDING_INLINE,
        'background-color': cssOklch({ l: 0.95, c: 0, h: 0, },),
        'border-block-end-style': 'solid',
        'border-block-end-color': BORDER_COLOR,
        'border-block-end-width': BORDER_WIDTH,
        'font-family': 'sans-serif',
        'font-size': cssRem(1,),
      },
    },),

    $({
      rule: '.toolbar-title',
      decls: { 'font-weight': FONT_WEIGHT_BOLD, },
    },),

    $({
      rule: '.toolbar button',
      decls: {
        'padding-block': BUTTON_PADDING_BLOCK,
        'padding-inline': BUTTON_PADDING_INLINE,
        cursor: 'pointer',
        'border-radius': BUTTON_RADIUS,
        'background-color': cssOklch({ l: 0.97, c: 0, h: 0, },),
        'border-block-style': 'solid',
        'border-block-color': BORDER_COLOR,
        'border-block-width': BORDER_WIDTH,
        'border-inline-style': 'solid',
        'border-inline-color': BORDER_COLOR,
        'border-inline-width': BORDER_WIDTH,
        'font-family': 'sans-serif',
        'font-size': cssRem(1,),
      },
    },),

    $({
      rule: '.toolbar button:hover',
      decls: { 'background-color': cssOklch({ l: 0.92, c: 0, h: 0, },), },
    },),

    ...renderToolbarControlStyles(),
    ...renderToggleGroupStyles(),
  ];
}
