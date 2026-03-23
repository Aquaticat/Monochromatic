/**
 * Toggle-group CSS rules for the doodle widget toolbar.
 *
 * Covers the radio-based exclusive toggle group used for tool selection,
 * including hidden radio inputs, label styling, and checked-state feedback.
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

/**
 * Generates CSS rules for the radio-based toggle button group.
 *
 * @returns array of minified CSS rule strings
 *
 * @example
 * ```ts
 * const css = renderToggleGroupStyles().join('');
 * ```
 */
export function renderToggleGroupStyles(): string[] {
  return [
    $({
      rule: '.toggle-group',
      decls: { display: 'flex', },
    },),

    /** Hide the native radio circle */
    $({
      rule: '.toggle-option input',
      decls: {
        position: 'absolute',
        appearance: 'none',
        'inline-size': cssNum(0,),
        'block-size': cssNum(0,),
        opacity: cssNum(0,),
      },
    },),

    $({
      rule: '.toggle-option',
      decls: {
        display: 'flex',
        'align-items': 'center',
        'padding-block': BUTTON_PADDING_BLOCK,
        'padding-inline': BUTTON_PADDING_INLINE,
        cursor: 'pointer',
        'background-color': cssOklch({ l: 0.97, c: 0, h: 0, },),
        'border-block-style': 'solid',
        'border-block-color': BORDER_COLOR,
        'border-block-width': BORDER_WIDTH,
        'border-inline-start-style': 'solid',
        'border-inline-start-color': BORDER_COLOR,
        'border-inline-start-width': BORDER_WIDTH,
        'border-inline-end-width': cssNum(0,),
        'border-radius': cssNum(0,),
        'font-family': 'sans-serif',
        'font-size': cssRem(1,),
      },
    },),

    $({
      rule: '.toggle-option:first-child',
      decls: {
        'border-start-start-radius': BUTTON_RADIUS,
        'border-end-start-radius': BUTTON_RADIUS,
      },
    },),

    $({
      rule: '.toggle-option:last-child',
      decls: {
        'border-start-end-radius': BUTTON_RADIUS,
        'border-end-end-radius': BUTTON_RADIUS,
        'border-inline-end-width': BORDER_WIDTH,
        'border-inline-end-style': 'solid',
        'border-inline-end-color': BORDER_COLOR,
      },
    },),

    $({
      rule: '.toggle-option:hover',
      decls: { 'background-color': cssOklch({ l: 0.92, c: 0, h: 0, },), },
    },),

    /** Active state driven by native :checked pseudo-class */
    $({
      rule: '.toggle-option:has(input:checked)',
      decls: { 'background-color': cssOklch({ l: 0.82, c: 0, h: 0, },), },
    },),

    $({
      rule: '.toggle-option:has(input:checked):hover',
      decls: { 'background-color': cssOklch({ l: 0.78, c: 0, h: 0, },), },
    },),
  ];
}
