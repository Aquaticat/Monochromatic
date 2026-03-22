/**
 * Shadow DOM styles for the `<hover-popup>` web component.
 */

import {
  $,
  cssCommaList,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Maximum width of the hover popup as percentage of viewport. */
const MAX_WIDTH_PERCENT = 60;

/** Maximum height of the hover popup in rem. */
const MAX_HEIGHT_REM = 20;

/** Border radius in rem: 1/4. */
const BORDER_RADIUS = 1 / (2 * 2);

/** Padding in rem. */
const PADDING = 1 / 2;

/** Font size in rem: 13/16. */
const FONT_SIZE = (16 - 2 - 1) / 16;

/** Line height multiplier. */
const LINE_HEIGHT = (2 + 1) / 2;

/** Shadow DOM styles for the hover popup. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      inset: 'auto',
      margin: cssNum(0,),
      position: 'fixed',
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
].join('',);
