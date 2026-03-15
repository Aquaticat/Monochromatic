/**
 * Search icon styles for the `<top-nav>` web component.
 *
 * Separated from the main top-nav styles to keep each file under the line limit.
 */
import {
  cssCalc,
  cssCompounded,
  cssRem,
  cssRotate,
  cssTurn,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import { $ as css, } from '../css.ts';
import { borderRadiusFull, } from '../mixins.ts';

/** CSS rules for the search icon `.search-icon`, `.circle`, and `.handle` elements. */
export const TOP_NAV_ICON_STYLES = [
  css({
    rule: '.search-icon',
    decls: { 'inline-size': cssRem(2,), 'block-size': cssRem(2,), position: 'relative', },
  },),
  css({
    rule: '.circle',
    decls: {
      position: 'absolute',
      'inset-block-start': 0,
      'inset-inline-start': 0,
      'inline-size': cssRem(1.375,),
      'block-size': cssRem(1.375,),
      'border-width': cssRem(0.25,),
      'border-style': 'solid',
      'border-color': cssVar('fg',),
      ...borderRadiusFull(),
    },
  },),
  css({
    rule: '.handle',
    decls: {
      position: 'absolute',
      'inset-block-start': cssCalc(`${cssRem(19,)} / 16`,),
      'inset-inline-start': cssCalc(`${cssRem(19,)} / 16`,),
      'inline-size': cssRem(0.25,),
      'block-size': cssRem(0.875,),
      'background-color': cssVar('fg',),
      transform: cssRotate(cssTurn(-0.125,),),
      'transform-origin': cssCompounded(['top', 'left',],),
    },
  },),
];
