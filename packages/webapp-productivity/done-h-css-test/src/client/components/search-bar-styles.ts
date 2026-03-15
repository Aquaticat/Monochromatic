/**
 * Shadow DOM styles for the `<search-bar>` web component.
 */
import {
  cssCalc,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import { $ as css, } from '../css.ts';
import { stickyBar, } from '../mixins-composed.ts';
import {
  appearanceNone,
  flexCenter,
  focusOutline,
  minTouchTarget,
  shadowDomGlobals,
} from '../mixins.ts';

/** Compiled CSS string for `<search-bar>` Shadow DOM. */
export const SEARCH_BAR_STYLES = [
  css({
    rule: ':host',
    decls: stickyBar(),
  },),
  css({
    rule: '.back',
    decls: {
      ...appearanceNone(),
      ...flexCenter(),
      ...minTouchTarget(),
      'font-size': cssRem(1.5,),
      color: cssVar('fg',),
    },
    children: [
      css({ rule: '&:focus-visible',
        decls: focusOutline({ offset: cssRem(-0.125,), },), },),
    ],
  },),
  css({
    rule: 'input',
    decls: {
      'flex-grow': 1,
      'border-style': 'none',
      'background-color': 'transparent',
      'font-size': cssRem(1,),
      'font-family': 'inherit',
      color: cssVar('fg',),
      'outline-style': 'none',
      'block-size': cssPercent(100,),
    },
  },),
  ...shadowDomGlobals(),
  css({
    at: 'media',
    params: '(min-width: 48rem)',
    children: [
      css({
        rule: ':host',
        decls: {
          'border-block-end-width': cssCalc(`${cssRem(1,)} / 16`,),
          'border-block-end-style': 'solid',
          'border-block-end-color': cssVar('bg-weaker',),
        },
      },),
      css({ rule: '.back', decls: { display: 'none', }, },),
      css({ rule: 'input', decls: { 'font-size': cssRem(1.5,), }, },),
    ],
  },),
]
  .join('',);
