/**
 * Shadow DOM styles for the `<file-tree>` web component.
 *
 * Uses native `<details><summary>` for directory expand/collapse,
 * so no JS toggle state management is needed.
 */

import {
  $,
  cssCommaList,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Sidebar width in `rem`: 16 = 2 * 2 * 2 * 2. */
const SIDEBAR_WIDTH = 2 * 2 * 2 * 2;

/** Vertical padding for entry labels and summaries in `rem`: 0.125 = 1 / (2 * 2 * 2). */
const ENTRY_PADDING_BLOCK = 1 / (2 * 2 * 2);

/** Horizontal padding for entry labels and summaries in `rem`: 0.5 = 1 / 2. */
const ENTRY_PADDING_INLINE = 1 / 2;

/** Shadow DOM styles for the file tree. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      display: 'block',
      'inline-size': cssRem(SIDEBAR_WIDTH,),
      'block-size': cssPercent(100,),
      overflow: 'auto',
      'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
      'font-size': cssRem(1,),
      'line-height': cssNum((2 + 1) / 2,),
      color: cssVar('fg',),
      'user-select': 'none',
    },
  },),
  $({
    rule: 'details',
    decls: {
      'padding-inline-start': cssRem(1,),
    },
  },),
  $({
    rule: 'summary',
    decls: {
      display: 'flex',
      'align-items': 'center',
      'padding-block': cssRem(ENTRY_PADDING_BLOCK,),
      'padding-inline': cssRem(ENTRY_PADDING_INLINE,),
      cursor: 'pointer',
      'white-space': 'nowrap',
      'list-style': 'none',
    },
  },),
  $({
    rule: 'summary::-webkit-details-marker',
    decls: {
      display: 'none',
    },
  },),
  $({
    rule: 'summary::marker',
    decls: {
      display: 'none',
    },
  },),
  $({
    rule: 'summary:hover, .file-label:hover',
    decls: {
      'background-color': cssVar('tree-hover-bg',),
    },
  },),
  $({
    rule: '.selected',
    decls: {
      'background-color': cssVar('tree-selected-bg',),
    },
  },),
  $({
    rule: '.toggle',
    decls: {
      'inline-size': cssRem(1,),
      'flex-shrink': cssNum(0,),
      'text-align': 'center',
    },
  },),
  $({
    rule: '.file-label',
    decls: {
      display: 'flex',
      'align-items': 'center',
      'padding-block': cssRem(ENTRY_PADDING_BLOCK,),
      'padding-inline': cssRem(ENTRY_PADDING_INLINE,),
      cursor: 'pointer',
      'white-space': 'nowrap',
    },
  },),
].join('',);

/** Collapsed directory indicator. */
export const COLLAPSED = '\u25B8';

/** Expanded directory indicator. */
export const EXPANDED = '\u25BE';
