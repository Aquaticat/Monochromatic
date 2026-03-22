/**
 * Shadow DOM styles for the `<binary-viewer>` web component.
 *
 * Layout rules for media elements (image, audio, video) and hex dump display.
 */

import {
  $,
  cssCommaList,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Full dimension as percentage. */
const FULL = 100;

/** Half dimension for 50% border-radius (circle). */
const HALF = 1 / 2;

/** Repeat button resting opacity. */
const REPEAT_RESTING_OPACITY = 0.8;

/** Shadow DOM styles for the binary viewer. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      display: 'none',
      flex: '1',
      overflow: 'auto',
      'flex-direction': 'column',
      'align-items': 'center',
      'justify-content': 'center',
      'background-color': cssVar('bg',),
    },
  },),
  $({
    rule: 'img',
    decls: {
      'max-inline-size': cssPercent(FULL,),
      'max-block-size': cssPercent(FULL,),
      'object-fit': 'contain',
    },
  },),
  $({
    rule: 'video',
    decls: {
      'max-inline-size': cssPercent(FULL,),
      'max-block-size': cssPercent(FULL,),
    },
  },),
  $({
    rule: '.audio-controls',
    decls: {
      display: 'flex',
      'align-items': 'center',
      gap: cssRem(1,),
    },
  },),
  $({
    rule: '.repeat-btn',
    decls: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'min-inline-size': cssRem(2.5,),
      'min-block-size': cssRem(2.5,),
      'border-radius': cssPercent(HALF * FULL,),
      border: 'none',
      'background-color': cssVar('gutter-fg',),
      color: cssVar('bg',),
      cursor: 'pointer',
      opacity: cssNum(REPEAT_RESTING_OPACITY,),
      transition: 'opacity 0.15s',
    },
  },),
  $({
    rule: '.repeat-btn:hover',
    decls: {
      opacity: cssNum(1,),
    },
  },),
  $({
    rule: '.repeat-btn[data-active]',
    decls: {
      opacity: cssNum(1,),
      'background-color': cssVar('fg',),
    },
  },),
  $({
    rule: '.media-info',
    decls: {
      'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
      'line-height': cssNum((2 + 1) / 2,),
      'padding-block': cssRem(1,),
      'padding-inline': cssRem(1,),
      margin: '0',
      color: cssVar('fg',),
      'white-space': 'pre-wrap',
    },
  },),
  $({
    rule: 'pre',
    decls: {
      'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
      'font-size': cssRem(1,),
      'line-height': cssNum((2 + 1) / 2,),
      'padding-block': cssRem(1,),
      'padding-inline': cssRem(1,),
      margin: '0',
      overflow: 'auto',
      'align-self': 'start',
      color: cssVar('fg',),
      'white-space': 'pre',
    },
  },),
].join('',);
