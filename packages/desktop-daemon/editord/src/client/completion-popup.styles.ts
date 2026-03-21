/**
 * Shadow DOM styles for the `<completion-popup>` web component.
 */

import {
  $,
  cssCommaList,
  cssInt,
  cssNum,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Maximum height of the completion popup in rem. */
const MAX_HEIGHT_REM = 16;

/** Width of the completion popup in rem. */
const WIDTH_REM = 20;

/** Border radius in rem: 1/4. */
const BORDER_RADIUS = 1 / (2 * 2);

/** Item padding in rem: 1/4. */
const ITEM_PADDING = 1 / (2 * 2);

/** Font size in rem: 13/16. */
const FONT_SIZE = (16 - 2 - 1) / 16;

/** Line height multiplier. */
const LINE_HEIGHT = (2 + 1) / 2;

/** Z-index above hover popup. */
const Z_INDEX = 110;

/** Shadow DOM styles for the completion popup. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      display: 'none',
      position: 'fixed',
      'z-index': cssInt(Z_INDEX,),
      'inline-size': cssRem(WIDTH_REM,),
      'max-block-size': cssRem(MAX_HEIGHT_REM,),
      overflow: 'auto',
      'background-color': cssVar('hover-bg',),
      color: cssVar('fg',),
      'border-radius': cssRem(BORDER_RADIUS,),
      'border-block-width': cssRem(1 / 16,),
      'border-block-style': 'solid',
      'border-block-color': cssVar('hover-border',),
      'border-inline-width': cssRem(1 / 16,),
      'border-inline-style': 'solid',
      'border-inline-color': cssVar('hover-border',),
      'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
      'font-size': cssRem(FONT_SIZE,),
      'line-height': cssNum(LINE_HEIGHT,),
    },
  },),
  $({
    rule: ':host([visible])',
    decls: {
      display: 'block',
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
