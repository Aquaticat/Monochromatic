/**
 * Toolbar and button CSS rules for the doodle widget.
 *
 * Covers the top toolbar bar, title, and standalone button styling.
 * Toggle-group rules are composed from {@link renderToggleGroupStyles}.
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
import { renderToggleGroupStyles, } from './styles-toolbar-toggle.ts';

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
        'background-color': cssOklch({ l: 0.95, c: 0, h: 0, },),
        'border-block-end-style': 'solid',
        'border-block-end-color': BORDER_COLOR,
      },
      raw: ';border-block-end-width:1px',
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
        'border-inline-style': 'solid',
        'border-inline-color': BORDER_COLOR,
      },
      raw: ';border-block-width:1px;border-inline-width:1px',
    },),

    $({
      rule: '.toolbar button:hover',
      decls: { 'background-color': cssOklch({ l: 0.92, c: 0, h: 0, },), },
    },),

    //region Export group (connected button + select)

    $({
      rule: '.export-group',
      decls: { display: 'flex', },
    },),

    $({
      rule: '.export-group > button',
      raw: 'border-start-end-radius:0;border-end-end-radius:0;border-inline-end-width:0',
    },),

    $({
      rule: '.export-group > select',
      decls: {
        'padding-block': BUTTON_PADDING_BLOCK,
        'padding-inline': BUTTON_PADDING_INLINE,
        cursor: 'pointer',
        'background-color': cssOklch({ l: 0.97, c: 0, h: 0, },),
        'border-block-style': 'solid',
        'border-block-color': BORDER_COLOR,
        'border-inline-style': 'solid',
        'border-inline-color': BORDER_COLOR,
        'border-radius': BUTTON_RADIUS,
      },
      raw: ';border-block-width:1px;border-inline-width:1px;border-start-start-radius:0;border-end-start-radius:0;font-family:inherit;font-size:inherit',
    },),

    $({
      rule: '.export-group > select:hover',
      decls: { 'background-color': cssOklch({ l: 0.92, c: 0, h: 0, },), },
    },),

    //endregion Export group

    //region Draw settings (color picker + size slider)

    $({
      rule: '.draw-settings',
      decls: { display: 'flex', 'align-items': 'center', },
      raw: ';gap:0.5rem',
    },),

    $({
      rule: '#color-picker',
      decls: {
        cursor: 'pointer',
        'border-radius': BUTTON_RADIUS,
        'border-block-style': 'solid',
        'border-block-color': BORDER_COLOR,
        'border-inline-style': 'solid',
        'border-inline-color': BORDER_COLOR,
      },
      raw: ';border-block-width:1px;border-inline-width:1px;inline-size:2rem;block-size:2rem;padding-block:0.125rem;padding-inline:0.125rem',
    },),

    $({
      rule: '#size-slider',
      decls: { cursor: 'pointer', },
      raw: ';inline-size:6rem',
    },),

    //endregion Draw settings

    ...renderToggleGroupStyles(),
  ];
}
