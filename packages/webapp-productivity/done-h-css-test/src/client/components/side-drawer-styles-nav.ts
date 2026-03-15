/**
 * Shared navigation styles for the `<side-drawer>` web component.
 *
 * Covers the divider, nav container, anchor links, header bar,
 * and close button used by both the inline sidebar and the popover panel.
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

/** Compiled CSS rules for shared `<side-drawer>` navigation elements. */
export const SIDE_DRAWER_NAV_STYLES = [
  css({
    rule: '.divider',
    decls: {
      'block-size': cssCalc(`${cssRem(1,)} / 16`,),
      'background-color': cssVar('bg-weaker',),
      'inline-size': cssPercent(100,),
    },
  },),
  css({
    rule: 'nav',
    decls: { ...flexColumn(), gap: cssVar('min-gap',), 'flex-grow': 1,
      'padding-block-start': cssVar('min-gap',), },
  },),
  css({
    rule: 'a',
    decls: {
      ...flexRow(),
      gap: cssVar('min-gap',),
      'min-block-size': cssRem(3,),
      'padding-block': 0,
      'padding-inline': cssVar('min-gap',),
      color: cssVar('fg',),
      'text-decoration': 'none',
      'font-size': cssRem(1.25,),
      'font-weight': cssInt(400,),
    },
    children: [
      css({ rule: '&:hover', decls: { 'background-color': cssVar('hover-bg',), }, },),
      css({ rule: '&:focus-visible',
        decls: focusOutline({ offset: cssRem(-0.125,), },), },),
    ],
  },),
  css({
    rule: '.header',
    decls: {
      ...flexRow(),
      'justify-content': 'space-between',
      'padding-block-start': cssVar('min-gap',),
      'padding-block-end': cssVar('min-padding',),
      'padding-inline-start': cssVar('min-gap',),
      'padding-inline-end': cssVar('min-padding',),
      'min-block-size': cssRem(4,),
    },
  },),
  css({
    rule: '.close',
    decls: { ...appearanceNone(), ...flexCenter(), ...minTouchTarget(), },
    children: [
      css({ rule: '&:focus-visible',
        decls: focusOutline({ offset: cssRem(-0.125,), },), },),
      css({ rule: '& svg',
        decls: { 'inline-size': cssRem(2,), 'block-size': cssRem(2,), }, },),
    ],
  },),
];
