/**
 * Shadow DOM styles for the `<task-detail>` web component.
 */
import {
  cssCalc,
  cssInt,
  cssPercent,
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
  minTouchTarget,
} from '../mixins.ts';
import { TASK_DETAIL_INTERACTIVE_STYLES, } from './task-detail-styles-interactive.ts';

/** Compiled CSS string for `<task-detail>` Shadow DOM. */
export const TASK_DETAIL_STYLES = [
  css({
    rule: ':host',
    decls: { ...flexColumn(), gap: cssRem(1,), 'padding-block': cssRem(1,),
      'padding-inline': cssRem(1,), },
  },),
  css({
    rule: '.header',
    decls: { ...flexRow(), 'justify-content': 'space-between', },
  },),
  css({
    rule: '.close',
    decls: { ...appearanceNone(), ...flexCenter(), ...minTouchTarget(), },
    children: [
      css({ rule: '&:focus-visible',
        decls: focusOutline({ offset: cssRem(-0.125,), },), },),
      css({
        rule: '& svg',
        decls: { 'inline-size': cssRem(2,), 'block-size': cssRem(2,),
          stroke: cssVar('fg',), 'stroke-width': cssInt(4,), },
      },),
    ],
  },),
  css({
    rule: '.heading',
    decls: { 'font-size': cssRem(1.5,), 'font-weight': cssInt(400,), },
  },),
  css({
    rule: '.title-input',
    decls: {
      'font-size': cssRem(1.5,),
      'font-weight': cssInt(400,),
      'border-style': 'none',
      'border-block-end-width': cssCalc(`${cssRem(1,)} / 16`,),
      'border-block-end-style': 'solid',
      'border-block-end-color': cssVar('fg',),
      'background-color': 'transparent',
      'inline-size': cssPercent(100,),
      'padding-block': cssRem(0.25,),
      'padding-inline': 0,
      'outline-style': 'none',
      'font-family': 'inherit',
      color: cssVar('fg',),
    },
  },),
  css({
    rule: '.desc-input',
    decls: {
      'border-width': cssCalc(`${cssRem(1,)} / 16`,),
      'border-style': 'solid',
      'border-color': cssVar('fg',),
      'padding-block': cssRem(0.5,),
      'padding-inline': cssRem(0.5,),
      'min-block-size': cssRem(4.5,),
      resize: 'vertical',
      'font-family': 'inherit',
      'font-size': 'inherit',
      'font-style': 'inherit',
      'font-weight': 'inherit',
      'line-height': 'inherit',
      color: cssVar('fg',),
      'background-color': 'transparent',
    },
  },),
  css({
    rule: '.actions',
    decls: { display: 'flex', gap: cssRem(1,), },
  },),
  TASK_DETAIL_INTERACTIVE_STYLES,
]
  .join('',);
