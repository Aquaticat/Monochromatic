/**
 * CSS rules for inlay hint annotations rendered via `::before`.
 *
 * Includes the hint pill styling and severity-colored variants.
 * Line number offset for annotated lines is also defined here.
 */

import {
  $,
  cssEm,
  cssNum,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

/** Editor line height multiplier: 1.5 = (2 + 1) / 2. */
const LINE_HEIGHT = (2 + 1) / 2;

/** Inlay hint border radius in em. */
const INLAY_BORDER_RADIUS = 1 / (2 + 2);

/** Inlay hint inline padding in em. */
const INLAY_PADDING_INLINE = 1 / (2 + 2);

/** CSS rules for inlay hint annotations. */
export const INLAY_STYLES = [
  $({
    rule: '.editor > div[data-inlay]::after',
    decls: {
      'inset-block-start': cssVar('line-num-offset',),
    },
  },),
  $({
    rule: '.editor > div[data-inlay]::before',
    decls: {
      content: 'attr(data-inlay)',
      display: 'block',
      'inline-size': 'fit-content',
      color: cssVar('inlay-fg',),
      'background-color': cssVar('inlay-bg',),
      'border-radius': cssEm(INLAY_BORDER_RADIUS,),
      'padding-inline': cssEm(INLAY_PADDING_INLINE,),
      'margin-inline-start': cssVar('inlay-indent',),
      'pointer-events': 'none',
      'user-select': 'none',
      'white-space': 'pre-wrap',
      'line-height': cssNum(LINE_HEIGHT,),
    },
  },),
  $({
    rule: '.editor > div[data-inlay-severity="error"]::before',
    decls: {
      color: cssVar('diag-error',),
      'background-color': cssVar('inlay-bg-error',),
    },
  },),
  $({
    rule: '.editor > div[data-inlay-severity="warning"]::before',
    decls: {
      color: cssVar('diag-warning',),
      'background-color': cssVar('inlay-bg-warning',),
    },
  },),
  $({
    rule: '.editor > div[data-inlay-severity="info"]::before',
    decls: {
      color: cssVar('diag-info',),
    },
  },),
].join('',);
