// oxlint-disable max-lines -- style rules for dialog, input, results, and result variants; splitting by concern loses co-location

/**
 * Shadow DOM styles for the `<search-overlay>` web component.
 *
 * Uses a native `<dialog>` element for the overlay.
 * The input sits at the top; results scroll below.
 */

import {
  $,
  cssCommaList,
  cssDvb,
  cssNum,
  cssOklch,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Overlay width as percentage of viewport inline size: 60%. */
const OVERLAY_WIDTH = 60;

/** Maximum overlay height in dynamic viewport block units: 70. */
const OVERLAY_MAX_HEIGHT = 70;

/** Input padding in `rem`: 0.75 = (2 + 1) / (2 * 2). */
const INPUT_PADDING = (2 + 1) / (2 * 2);

/** Result item padding in `rem`: 0.5 = 1 / 2. */
const RESULT_PADDING = 1 / 2;

/** Result line height multiplier: 1.5 = (2 + 1) / 2. */
const RESULT_LINE_HEIGHT = (2 + 1) / 2;

/** Backdrop opacity: 0.5 = 1 / 2. */
const BACKDROP_ALPHA = 1 / 2;

/** Shadow DOM styles for the search overlay. */
export const STYLES = [
  $({
    rule: 'dialog[open]',
    decls: {
      'inline-size': cssPercent(OVERLAY_WIDTH,),
      'max-block-size': cssDvb(OVERLAY_MAX_HEIGHT,),
      'border-block-style': 'none',
      'border-inline-style': 'none',
      'border-radius': cssRem(1 / 2,),
      'padding-block': cssRem(0,),
      'padding-inline': cssRem(0,),
      'background-color': cssVar('bg',),
      color: cssVar('fg',),
      'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
      'font-size': cssRem(1,),
      overflow: 'hidden',
      display: 'flex',
      'flex-direction': 'column',
    },
  },),
  $({
    rule: 'dialog::backdrop',
    decls: {
      'background-color': cssOklch({ l: 0, c: 0, h: 0, a: BACKDROP_ALPHA, },),
    },
  },),
  $({
    rule: '.search-input',
    decls: {
      'inline-size': cssPercent(100,),
      'padding-block': cssRem(INPUT_PADDING,),
      'padding-inline': cssRem(INPUT_PADDING,),
      'border-block-style': 'none',
      'border-inline-style': 'none',
      'border-block-end-width': cssRem(1 / (2 * 2 * 2 * 2),),
      'border-block-end-style': 'solid',
      'border-block-end-color': cssVar('gutter-fg',),
      'background-color': cssVar('bg',),
      color: cssVar('fg',),
      'font-family': 'inherit',
      'font-size': cssRem(1,),
      outline: 'none',
      'box-sizing': 'border-box',
    },
  },),
  $({
    rule: '.search-input::placeholder',
    decls: {
      color: cssVar('gutter-fg',),
    },
  },),
  $({
    rule: '.results',
    decls: {
      flex: '1',
      'overflow-y': 'auto',
      'overflow-x': 'hidden',
    },
  },),
  $({
    rule: '.result',
    decls: {
      display: 'flex',
      'align-items': 'baseline',
      'padding-block': cssRem(RESULT_PADDING / 2,),
      'padding-inline': cssRem(RESULT_PADDING,),
      cursor: 'pointer',
      'line-height': cssNum(RESULT_LINE_HEIGHT,),
      'white-space': 'nowrap',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
    },
  },),
  $({
    rule: '.result:hover, .result[data-selected]',
    decls: {
      'background-color': cssVar('tree-hover-bg',),
    },
  },),
  $({
    rule: '.result-path',
    decls: {
      'flex-shrink': cssNum(1,),
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
    },
  },),
  $({
    rule: '.result-line',
    decls: {
      color: cssVar('gutter-fg',),
      'flex-shrink': cssNum(0,),
    },
  },),
  $({
    rule: '.result-text',
    decls: {
      color: cssVar('gutter-fg',),
      'margin-inline-start': cssRem(1,),
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'flex-shrink': cssNum(1,),
    },
  },),
  $({
    rule: '.empty',
    decls: {
      'padding-block': cssRem(RESULT_PADDING,),
      'padding-inline': cssRem(RESULT_PADDING,),
      color: cssVar('gutter-fg',),
    },
  },),
  $({
    rule: '::highlight(hl-search-match)',
    decls: {
      'background-color': cssVar('search-match-bg',),
    },
  },),
].join('',);
