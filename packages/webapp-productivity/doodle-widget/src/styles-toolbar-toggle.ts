/**
 * Toggle-group CSS rules for the doodle widget toolbar.
 *
 * Covers the radio-based exclusive toggle group used for tool selection,
 * including hidden radio inputs, label styling, and checked-state feedback.
 */
import {
  $,
  cssOklch,
} from '@monochromatic-dev/module-es/h-css';
import {
  BORDER_COLOR,
  BUTTON_PADDING_BLOCK,
  BUTTON_PADDING_INLINE,
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
      decls: { position: 'absolute', },
      raw: ';appearance:none;width:0;height:0;opacity:0',
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
        'border-inline-start-style': 'solid',
        'border-inline-start-color': BORDER_COLOR,
      },
      raw:
        ';border-block-width:1px;border-inline-start-width:1px;border-inline-end-width:0;border-radius:0',
    },),

    $({
      rule: '.toggle-option:first-child',
      raw: 'border-start-start-radius:0.25rem;border-end-start-radius:0.25rem',
    },),

    $({
      rule: '.toggle-option:last-child',
      raw:
        `border-start-end-radius:0.25rem;border-end-end-radius:0.25rem;border-inline-end-width:1px;border-inline-end-style:solid;border-inline-end-color:${
          String(BORDER_COLOR,)
        }`,
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
