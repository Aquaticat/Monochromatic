/**
 * Shadow DOM styles for the `<top-nav>` web component.
 */
import {
  cssCalc,
  cssCompounded,
  cssInt,
  cssRem,
  cssRotate,
  cssTurn,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import { $ as css, } from '../css.ts';
import { stickyBar, } from '../mixins-composed.ts';
import {
  appearanceNone,
  borderRadiusFull,
  flexCenter,
  flexColumn,
  focusOutline,
  minTouchTarget,
} from '../mixins.ts';
import { TOP_NAV_MEDIA_STYLES, } from './top-nav-styles-media.ts';

/** Compiled CSS string for `<top-nav>` Shadow DOM. */
export const TOP_NAV_STYLES = [
  css({
    rule: ':host',
    decls: { ...stickyBar(), 'justify-content': 'center', },
  },),
  css({
    rule: 'h1',
    decls: {
      'flex-grow': 1,
      'text-align': 'center',
      'font-size': cssRem(1.5,),
      'font-weight': cssInt(400,),
      'line-height': 'normal',
      'margin-block': 0,
      'margin-inline': 0,
    },
  },),
  css({
    rule: '.action',
    decls: {
      ...appearanceNone(),
      ...flexCenter(),
      ...minTouchTarget(),
      color: cssVar('fg',),
      'text-decoration': 'none',
    },
    children: [
      css({ rule: '&:focus-visible',
        decls: focusOutline({ offset: cssRem(-0.125,), },), },),
    ],
  },),
  css({
    rule: '.hamburger',
    decls: {
      'inline-size': cssRem(2,),
      'block-size': cssRem(2,),
      ...flexColumn(),
      'justify-content': 'center',
      'align-items': 'center',
      gap: cssRem(0.375,),
    },
  },),
  css({
    rule: '.line',
    decls: {
      'inline-size': cssRem(1.75,),
      'block-size': cssRem(0.25,),
      'background-color': cssVar('fg',),
      display: 'block',
    },
  },),
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
  TOP_NAV_MEDIA_STYLES,
]
  .join('',);
