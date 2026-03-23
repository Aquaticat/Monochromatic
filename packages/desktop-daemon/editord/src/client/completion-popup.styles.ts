/**
 * Shadow DOM styles for the `<completion-popup>` web component.
 */

import {
  $,
  cssNum,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

import {
  CODE_LINE_HEIGHT,
  MONO_FONT_FAMILY,
  POPUP_BORDER_DECLS,
  POPUP_BORDER_RADIUS,
  POPUP_FONT_SIZE,
} from './style-tokens.ts';

/** Maximum height of the completion popup in rem. */
const MAX_HEIGHT_REM = 16;

/** Width of the completion popup in rem. */
const WIDTH_REM = 20;

/** Item padding in rem: 1/4. */
const ITEM_PADDING = 1 / (2 * 2);

/** Shadow DOM styles for the completion popup. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      inset: 'auto',
      margin: cssNum(0,),
      position: 'fixed',
      'inline-size': cssRem(WIDTH_REM,),
      'max-block-size': cssRem(MAX_HEIGHT_REM,),
      overflow: 'auto',
      'background-color': cssVar('hover-bg',),
      color: cssVar('fg',),
      'border-radius': cssRem(POPUP_BORDER_RADIUS,),
      ...POPUP_BORDER_DECLS,
      'font-family': MONO_FONT_FAMILY,
      'font-size': cssRem(POPUP_FONT_SIZE,),
      'line-height': cssNum(CODE_LINE_HEIGHT,),
    },
  },),
  $({
    rule: '.item',
    decls: {
      'padding-block': cssRem(ITEM_PADDING,),
      'padding-inline': cssRem(ITEM_PADDING * 2,),
      cursor: 'pointer',
      'white-space': 'nowrap',
      'text-overflow': 'ellipsis',
      overflow: 'hidden',
    },
  },),
  $({
    rule: '.item[data-selected]',
    decls: {
      'background-color': cssVar('tree-selected-bg',),
    },
  },),
  $({
    rule: '.detail',
    decls: {
      color: cssVar('gutter-fg',),
      'margin-inline-start': cssRem(1 / 2,),
    },
  },),
].join('',);
