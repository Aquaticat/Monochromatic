/**
 * Shadow DOM styles for the `<file-tree>` web component.
 */

import {
  $,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
  type CssValue,
} from '@monochromatic-dev/module-es/h-css';

/** Collapsed directory indicator (▸). */
export const COLLAPSED = '\u25B8';

/** Expanded directory indicator (▾). */
export const EXPANDED = '\u25BE';

/** Shadow DOM styles for the file tree. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      display: 'block',
      'inline-size': cssRem(16,),
      'block-size': cssPercent(100,),
      overflow: 'auto',
      'font-family': "'JetBrains Mono', monospace" as CssValue,
      'font-size': cssRem(0.875,),
      'line-height': cssNum(1.4,),
      color: cssVar('fg',),
      'user-select': 'none',
    },
  },),
  $({
    rule: '.entry-label',
    decls: {
      display: 'flex',
      'align-items': 'center',
      'padding-block': cssRem(0.125,),
      'padding-inline': cssRem(0.5,),
      cursor: 'pointer',
      'white-space': 'nowrap',
    },
  },),
  $({
    rule: '.entry-label:hover',
    decls: {
      'background-color': cssVar('tree-hover-bg',),
    },
  },),
  $({
    rule: '.entry-label.selected',
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
    rule: '.children',
    decls: {
      'padding-inline-start': cssRem(1,),
    },
  },),
].join('',);
