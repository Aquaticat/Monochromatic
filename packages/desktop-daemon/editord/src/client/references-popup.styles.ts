/**
 * Shadow DOM styles for the `<references-popup>` web component.
 *
 * Anchor positioning properties are set as inline styles on the host
 * to avoid shadow DOM scope issues with `anchor-name` resolution.
 * The Popover API provides top-layer rendering and light dismiss.
 */

import {
  $,
  cssAnchor,
  cssCommaList,
  cssNum,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Maximum width of the references popup in rem. */
const MAX_WIDTH_REM = 30;

/** Maximum height of the references popup in rem. */
const MAX_HEIGHT_REM = 16;

/** Border radius in rem: 1/4. */
const BORDER_RADIUS = 1 / (2 * 2);

/** Item padding in rem: 1/4. */
const ITEM_PADDING = 1 / (2 * 2);

/** Font size in rem: 13/16. */
const FONT_SIZE = (16 - 2 - 1) / 16;

/** Line height multiplier. */
const LINE_HEIGHT = (2 + 1) / 2;

/** Shadow DOM styles for the references popup. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      inset: 'auto',
      margin: cssNum(0,),
      'inset-block-start': cssAnchor('end',),
      'inset-inline-start': cssAnchor('start',),
      'position-try-fallbacks': cssCommaList(['flip-block', 'flip-inline', 'flip-block flip-inline',],),
      'inline-size': 'max-content',
      'max-inline-size': cssRem(MAX_WIDTH_REM,),
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
    rule: '.item',
    decls: {
      display: 'flex',
      'align-items': 'baseline',
      'padding-block': cssRem(ITEM_PADDING,),
      'padding-inline': cssRem(ITEM_PADDING * 2,),
      cursor: 'pointer',
      'white-space': 'nowrap',
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
    rule: '.item-path',
    decls: {
      'flex-shrink': cssNum(1,),
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
    },
  },),
  $({
    rule: '.line-num',
    decls: {
      color: cssVar('gutter-fg',),
      'flex-shrink': cssNum(0,),
    },
  },),
].join('',);
