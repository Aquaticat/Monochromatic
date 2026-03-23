/**
 * Export group and draw settings CSS rules for the doodle widget toolbar.
 *
 * Covers the connected export button + format select, color picker,
 * and stroke width slider styling.
 */
import {
  $,
  cssNum,
  cssOklch,
  cssRem,
} from '@monochromatic-dev/module-es/h-css';
import {
  BORDER_COLOR,
  BORDER_WIDTH,
  BUTTON_PADDING_BLOCK,
  BUTTON_PADDING_INLINE,
  BUTTON_RADIUS,
} from './style-tokens.ts';

/** Color picker square size */
const COLOR_PICKER_SIZE = 2;

/** Stroke width slider track length */
const SLIDER_INLINE_SIZE = 2 + 2 + 2;

/**
 * Generates CSS rules for the export group and draw settings controls.
 *
 * @returns array of minified CSS rule strings
 *
 * @example
 * ```ts
 * const css = renderToolbarControlStyles().join('');
 * ```
 */
export function renderToolbarControlStyles(): string[] {
  return [
    //region Export group (connected button + select)

    $({
      rule: '.export-group',
      decls: { display: 'flex', },
    },),

    $({
      rule: '.export-group > button',
      decls: {
        'border-start-end-radius': cssNum(0,),
        'border-end-end-radius': cssNum(0,),
        'border-inline-end-width': cssNum(0,),
      },
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
        'border-block-width': BORDER_WIDTH,
        'border-inline-style': 'solid',
        'border-inline-color': BORDER_COLOR,
        'border-inline-width': BORDER_WIDTH,
        'border-radius': BUTTON_RADIUS,
        'border-start-start-radius': cssNum(0,),
        'border-end-start-radius': cssNum(0,),
        'font-family': 'inherit',
        'font-size': 'inherit',
      },
    },),

    $({
      rule: '.export-group > select:hover',
      decls: { 'background-color': cssOklch({ l: 0.92, c: 0, h: 0, },), },
    },),

    //endregion Export group

    //region Draw settings (color picker + size slider)

    $({
      rule: '.draw-settings',
      decls: {
        display: 'flex',
        'align-items': 'center',
        gap: cssRem(1 / 2,),
      },
    },),

    $({
      rule: '#color-picker',
      decls: {
        cursor: 'pointer',
        'border-radius': BUTTON_RADIUS,
        'border-block-style': 'solid',
        'border-block-color': BORDER_COLOR,
        'border-block-width': BORDER_WIDTH,
        'border-inline-style': 'solid',
        'border-inline-color': BORDER_COLOR,
        'border-inline-width': BORDER_WIDTH,
        'inline-size': cssRem(COLOR_PICKER_SIZE,),
        'block-size': cssRem(COLOR_PICKER_SIZE,),
        'padding-block': cssRem(1 / (2 * 2 * 2),),
        'padding-inline': cssRem(1 / (2 * 2 * 2),),
      },
    },),

    $({
      rule: '#size-slider',
      decls: {
        cursor: 'pointer',
        'inline-size': cssRem(SLIDER_INLINE_SIZE,),
      },
    },),

    //endregion Draw settings
  ];
}
