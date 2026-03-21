// oxlint-disable max-lines -- style rules for editor layout, line numbers, and 10 syntax highlight groups; splitting by concern loses co-location

/**
 * Shadow DOM styles for the `<editor-pane>` web component.
 */

import {
  $,
  cssCh,
  cssCommaList,
  cssInt,
  cssLh,
  cssNum,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Full viewport height as percentage. */
const FULL_HEIGHT = 100;

/** Editor line height multiplier: 1.5 = (2 + 1) / 2. */
const LINE_HEIGHT = (2 + 1) / 2;

/** Width of the line number gutter in `ch` units: 5 = 2 * 2 + 1. */
const GUTTER_WIDTH = 2 * 2 + 1;

/** Total left padding (gutter + gap) in `ch` units: 6 = (2 + 1) * 2. */
const LINE_PADDING = (2 + 1) * 2;

/** Shadow DOM styles for the editor pane. */
export const STYLES = [
  $({
    rule: ':host',
    decls: {
      display: 'block',
      flex: '1',
      overflow: 'auto',
    },
  },),
  $({
    rule: '.editor',
    decls: {
      'min-block-size': cssPercent(FULL_HEIGHT,),
      'padding-block': cssVar('editor-padding',),
      'padding-inline': cssVar('editor-padding',),
      outline: 'none',
      'white-space': 'pre-wrap',
      'overflow-wrap': 'break-word',
      'font-family': cssCommaList(["'JetBrains Mono'", 'monospace',],),
      'font-size': cssRem(1,),
      'line-height': cssNum(LINE_HEIGHT,),
      'tab-size': cssInt(2,),
      color: cssVar('fg',),
      'caret-color': cssVar('fg',),
      'counter-reset': 'line',
    },
  },),
  $({
    rule: '.editor > div',
    decls: {
      'min-block-size': cssLh(1,),
      'counter-increment': 'line',
      position: 'relative',
      'padding-inline-start': cssCh(LINE_PADDING,),
    },
  },),
  $({
    rule: '.editor > div::before',
    decls: {
      content: 'counter(line)',
      position: 'absolute',
      'inset-inline-start': cssInt(0,),
      'inset-block-start': cssInt(0,),
      'inline-size': cssCh(GUTTER_WIDTH,),
      'text-align': 'end',
      color: cssVar('gutter-fg',),
      'user-select': 'none',
      'pointer-events': 'none',
    },
  },),
  $({
    rule: '::highlight(hl-keyword)',
    decls: { color: cssVar('hl-keyword',), },
  },),
  $({
    rule: '::highlight(hl-string)',
    decls: { color: cssVar('hl-string',), },
  },),
  $({
    rule: '::highlight(hl-comment)',
    decls: { color: cssVar('hl-comment',), },
  },),
  $({
    rule: '::highlight(hl-number)',
    decls: { color: cssVar('hl-number',), },
  },),
  $({
    rule: '::highlight(hl-type)',
    decls: { color: cssVar('hl-type',), },
  },),
  $({
    rule: '::highlight(hl-function)',
    decls: { color: cssVar('hl-function',), },
  },),
  $({
    rule: '::highlight(hl-property)',
    decls: { color: cssVar('hl-property',), },
  },),
  $({
    rule: '::highlight(hl-heading)',
    decls: { color: cssVar('hl-heading',), },
  },),
  $({
    rule: '::highlight(hl-link)',
    decls: { color: cssVar('hl-link',), 'text-decoration': 'underline', },
  },),
  $({
    rule: '::highlight(hl-emphasis)',
    decls: { color: cssVar('hl-emphasis',), },
  },),
  $({
    rule: '::highlight(diag-error)',
    decls: {
      'text-decoration-line': 'underline',
      'text-decoration-style': 'wavy',
      'text-decoration-color': cssVar('diag-error',),
      'text-decoration-skip-ink': 'none',
    },
  },),
  $({
    rule: '::highlight(diag-warning)',
    decls: {
      'text-decoration-line': 'underline',
      'text-decoration-style': 'wavy',
      'text-decoration-color': cssVar('diag-warning',),
      'text-decoration-skip-ink': 'none',
    },
  },),
  $({
    rule: '::highlight(diag-info)',
    decls: {
      'text-decoration-line': 'underline',
      'text-decoration-style': 'wavy',
      'text-decoration-color': cssVar('diag-info',),
      'text-decoration-skip-ink': 'none',
    },
  },),
  $({
    rule: '::highlight(diag-hint)',
    decls: {
      'text-decoration-line': 'underline',
      'text-decoration-style': 'wavy',
      'text-decoration-color': cssVar('diag-hint',),
      'text-decoration-skip-ink': 'none',
    },
  },),
].join('',);
