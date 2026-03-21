/**
 * Shadow DOM styles for the `<hover-popup>` web component.
 */

import {
  $,
  cssCommaList,
  cssInt,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Maximum width of the hover popup as percentage of viewport. */
const MAX_WIDTH_PERCENT = 60;

/** Maximum height of the hover popup in rem. */
const MAX_HEIGHT_REM = 20;

/** Border radius in rem. */
const BORDER_RADIUS = 1 / 4;

/** Padding in rem. */
const PADDING = 1 / 2;

/** Font size in rem. */
const FONT_SIZE = 13 / 16;

/** Line height multiplier. */
const LINE_HEIGHT = (2 + 1) / 2;

/** Z-index to ensure popup appears above editor content. */
const Z_INDEX = 100;

/** Shadow DOM styles for the hover popup. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      display: 'none',
      position: 'fixed',
      'z-index': cssInt(Z_INDEX,),
      'max-inline-size': cssPercent(MAX_WIDTH_PERCENT,),
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
      'padding-block': cssRem(PADDING,),
      'padding-inline': cssRem(PADDING,),
      'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
      'font-size': cssRem(FONT_SIZE,),
      'line-height': cssNum(LINE_HEIGHT,),
      'white-space': 'pre-wrap',
      'word-break': 'break-word',
    },
  },),
  $({
    rule: ':host([visible])',
    decls: {
      display: 'block',
    },
  },),
].join('',);
