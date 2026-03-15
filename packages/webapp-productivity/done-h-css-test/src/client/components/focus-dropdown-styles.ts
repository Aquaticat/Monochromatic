/**
 * Shadow DOM styles for the `<focus-dropdown>` web component.
 */
import {
  cssCalc,
  cssInt,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import { $ as css, } from '../css.ts';
import { buttonOutlined, } from '../mixins-composed.ts';
import { focusOutline, } from '../mixins.ts';

/** Compiled CSS string for `<focus-dropdown>` Shadow DOM. */
export const FOCUS_DROPDOWN_STYLES = [
  css({
    rule: ':host',
    decls: { display: 'block', 'inline-size': cssPercent(100,), position: 'relative', },
  },),
  css({
    rule: '.trigger',
    decls: { ...buttonOutlined(), 'inline-size': cssPercent(100,),
      'text-align': 'start', },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline(), },),
    ],
  },),
  css({
    rule: '.text',
    decls: { 'flex-grow': 1, 'text-align': 'start', },
  },),
  css({
    rule: '.divider',
    decls: {
      'inline-size': cssCalc(`${cssRem(1,)} / 16`,),
      'block-size': cssPercent(100,),
      'background-color': cssVar('fg-weaker',),
    },
  },),
  css({
    rule: '.menu',
    decls: {
      position: 'absolute',
      'inset-block-start': cssPercent(100,),
      'inset-inline-start': 0,
      'inline-size': cssPercent(100,),
      'border-width': cssCalc(`${cssRem(1,)} / 16`,),
      'border-style': 'solid',
      'border-color': cssVar('fg',),
      'background-color': cssVar('bg',),
      'padding-block': cssRem(0.25,),
      'padding-inline': 0,
      'margin-block': 0,
      'margin-inline': 0,
      'list-style': 'none',
      'z-index': cssInt(10,),
    },
    children: [
      css({ rule: '&:not(:popover-open)', decls: { display: 'none', }, },),
    ],
  },),
  css({
    rule: '.option',
    decls: { 'padding-block': cssRem(0.5,), 'padding-inline': cssRem(0.5,),
      cursor: 'pointer', },
    children: [
      css({ rule: '&:hover', decls: { 'background-color': cssVar('hover-bg',), }, },),
    ],
  },),
]
  .join('',);
