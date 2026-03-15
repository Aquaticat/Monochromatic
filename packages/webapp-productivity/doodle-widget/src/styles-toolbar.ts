/**
 * Toolbar and toggle-group CSS rules for the doodle widget.
 *
 * Covers the top toolbar bar, standalone buttons, and the
 * radio-based exclusive toggle group used for tool selection.
 */
import {
  $,
  cssOklch,
} from '@monochromatic-dev/module-es/h-css';
import {
  BORDER_COLOR,
  BUTTON_PADDING_BLOCK,
  BUTTON_PADDING_INLINE,
  BUTTON_RADIUS,
  FONT_WEIGHT_BOLD,
  TOOLBAR_GAP,
  TOOLBAR_PADDING_BLOCK,
  TOOLBAR_PADDING_INLINE,
} from './style-tokens.ts';

/**
 * Generates CSS rules for the toolbar, buttons, and toggle group.
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
      raw: `border-start-end-radius:0.25rem;border-end-end-radius:0.25rem;border-inline-end-width:1px;border-inline-end-style:solid;border-inline-end-color:${String(BORDER_COLOR)}`,
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
  ];
}
