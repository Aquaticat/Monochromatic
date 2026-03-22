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

/** Shadow DOM styles for the binary viewer. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      display: 'none',
      flex: '1',
      overflow: 'auto',
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
    rule: 'pre',
    decls: {
      'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
      'font-size': cssRem(1,),
      'line-height': cssNum((2 + 1) / 2,),
      'padding-block': cssRem(1,),
      'padding-inline': cssRem(1,),
      margin: '0',
      overflow: 'auto',
      'inline-size': cssPercent(FULL,),
      'align-self': 'start',
      color: cssVar('fg',),
      'white-space': 'pre',
    },
  },),
].join('',);
