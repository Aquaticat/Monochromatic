/**
 * Pill, button, and interactive element styles for `<task-detail>`.
 */
import {
  cssCalc,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import { $ as css, } from '../css.ts';
import { buttonOutlined, } from '../mixins-composed.ts';
import {
  borderRadiusFull,
  flexCenter,
  flexRow,
  focusOutline,
  scrollRow,
  shadowDomGlobals,
  whitespaceNowrap,
} from '../mixins.ts';

/** Pill, button row, and shadow DOM global styles for `<task-detail>`. */
export const TASK_DETAIL_INTERACTIVE_STYLES = [
  css({
    rule: '.pills',
    decls: { ...scrollRow(), 'flex-wrap': 'wrap', },
  },),
  css({
    rule: '.pill',
    decls: {
      ...flexCenter(),
      ...whitespaceNowrap(),
      'border-width': cssCalc(`${cssRem(1,)} / 16`,),
      'border-style': 'solid',
      'border-color': cssVar('fg',),
      ...borderRadiusFull(),
      'padding-block': cssRem(0.5,),
      'padding-inline': cssRem(0.5,),
      gap: cssRem(0.25,),
      'font-size': cssRem(1,),
      'line-height': 1.5,
    },
    children: [
      css({ rule: '&[data-autofilled]',
        decls: { 'border-color': cssVar('red-fg',), color: cssVar('red-fg',), }, },),
      css({ rule: '&[data-loading]', decls: { opacity: 0.5, }, },),
    ],
  },),
  css({
    rule: '.btn-row',
    decls: { ...flexRow(), gap: cssRem(0.5,), 'flex-wrap': 'wrap',
      'margin-block-start': cssRem(1,), },
    children: [
      css({ rule: '&[data-hidden]', decls: { display: 'none', }, },),
    ],
  },),
  css({
    rule: '.btn-outline',
    decls: buttonOutlined(),
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline(), },),
    ],
  },),
  css({
    rule: '.btn-primary',
    decls: { ...buttonOutlined(), 'background-color': cssVar('fg',),
      color: cssVar('bg',), },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline(), },),
    ],
  },),
  ...shadowDomGlobals(),
]
  .join('',);
