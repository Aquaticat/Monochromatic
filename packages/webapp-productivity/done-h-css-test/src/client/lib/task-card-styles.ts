/**
 * Shadow DOM styles for the `<task-card>` web component.
 */
import {
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import { $ as css, } from '../css.ts';
import {
  appearanceNone,
  flexCenter,
  flexColumn,
  flexRow,
  focusOutline,
  scrollRow,
  whitespaceNowrap,
} from '../mixins.ts';

/** Compiled CSS string for `<task-card>` Shadow DOM. */
export const TASK_CARD_STYLES = [
  css({
    rule: ':host',
    decls: { ...flexColumn(), gap: cssVar('min-gap',), 'background-color': cssVar('bg',),
      'overflow-x': 'hidden', 'overflow-y': 'hidden', cursor: 'pointer', },
  },),
  css({
    rule: '.row',
    decls: { ...flexRow(), gap: cssVar('min-gap',), 'align-items': 'flex-start', },
  },),
  css({
    rule: '.checkbox',
    decls: { ...appearanceNone(), ...flexCenter(), 'inline-size': cssRem(2,),
      'block-size': cssRem(2,), },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline(), },),
    ],
  },),
  css({
    rule: '.checkbox-box',
    decls: {
      'inline-size': cssRem(1.75,),
      'block-size': cssRem(1.75,),
      'border-width': cssRem(0.25,),
      'border-style': 'solid',
      'border-color': cssVar('fg',),
    },
  },),
  css({
    rule: '.title',
    decls: { 'font-size': cssRem(1.25,), 'font-weight': 400, 'line-height': 'normal',
      'flex-grow': 1, 'min-inline-size': 0, },
  },),
  css({
    rule: '.chips',
    decls: scrollRow(),
  },),
  css({ rule: '.chips::-webkit-scrollbar', decls: { display: 'none', }, },),
  css({
    rule: '.chip',
    decls: { ...flexRow(), ...whitespaceNowrap(), gap: cssRem(0.25,),
      'font-size': cssRem(1,), 'line-height': 1.5, },
  },),
  css({
    rule: '.chip.blocked',
    decls: { 'border-color': cssVar('red-fg',), color: cssVar('red-fg',), },
  },),
]
  .join('',);
