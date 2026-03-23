/**
 * Shadow DOM styles for the `<hover-popup>` web component.
 */

import {
  $,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

import {
  CODE_LINE_HEIGHT,
  MONO_FONT_FAMILY,
  POPUP_BORDER_DECLS,
  POPUP_BORDER_RADIUS,
  POPUP_FONT_SIZE,
} from '../styles/tokens.ts';

/** Invisible bridge that extends upward so the mouse can reach the popup. */
const BRIDGE_HEIGHT_REM = 1;

/** Maximum width of the hover popup as percentage of viewport. */
const MAX_WIDTH_PERCENT = 60;

/** Maximum height of the hover popup in rem. */
const MAX_HEIGHT_REM = 20;

/** Padding in rem. */
const PADDING = 1 / 2;

/** Shadow DOM styles for the hover popup. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      inset: 'auto',
      margin: cssNum(0,),
      position: 'fixed',
      'max-inline-size': cssPercent(MAX_WIDTH_PERCENT,),
      'background-color': cssVar('hover-bg',),
      color: cssVar('fg',),
      'border-radius': cssRem(POPUP_BORDER_RADIUS,),
      ...POPUP_BORDER_DECLS,
      'padding-block': cssRem(PADDING,),
      'padding-inline': cssRem(PADDING,),
      'font-family': MONO_FONT_FAMILY,
      'font-size': cssRem(POPUP_FONT_SIZE,),
      'line-height': cssNum(CODE_LINE_HEIGHT,),
      'white-space': 'pre-wrap',
      'word-break': 'break-word',
    },
  },),
  $({
    rule: '.content',
    decls: {
      'max-block-size': cssRem(MAX_HEIGHT_REM,),
      overflow: 'auto',
    },
  },),
  $({
    rule: ':host::before',
    decls: {
      content: "''",
      position: 'absolute',
      'inset-inline-start': cssNum(0,),
      'inset-inline-end': cssNum(0,),
      'inset-block-start': cssRem(-BRIDGE_HEIGHT_REM,),
      'block-size': cssRem(BRIDGE_HEIGHT_REM,),
    },
  },),
].join('',);
