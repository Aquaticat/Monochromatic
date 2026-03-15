/**
 * Shadow DOM styles for the `<side-drawer>` web component.
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
import { SIDE_DRAWER_PANEL_STYLES, } from './side-drawer-styles-panel.ts';

/** Viewport breakpoint matching the body flex-wrap threshold.
 *  Below this width the sidebar stacks and the inline nav hides. */
const DESKTOP_BREAKPOINT = '48rem';

/** Compiled CSS string for `<side-drawer>` Shadow DOM. */
export const SIDE_DRAWER_STYLES = [
  css({ rule: ':host', decls: { display: 'block', }, },),
  css({ rule: '.wrapper', decls: { 'block-size': cssPercent(100,), }, },),

  //region Shared nav styles
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
  //endregion Shared nav styles

  //region Inline sidebar
  css({
    rule: '.sidebar',
    decls: {
      ...flexColumn(),
      'block-size': cssPercent(100,),
      'border-inline-end-width': cssCalc(`${cssRem(1,)} / 16`,),
      'border-inline-end-style': 'solid',
      'border-inline-end-color': cssVar('bg-weaker',),
      display: 'none',
    },
    children: [
      css({
        rule: '& .header',
        decls: {
          'padding-block': cssVar('min-padding',),
          'padding-inline-start': cssVar('min-gap',),
          'padding-inline-end': cssVar('min-padding',),
        },
      },),
      css({ rule: '& .close', decls: { display: 'none', }, },),
    ],
  },),
  css({
    at: 'media',
    params: `(min-width: ${DESKTOP_BREAKPOINT})`,
    children: [
      css({ rule: '.sidebar', decls: { ...flexColumn(), }, },),
    ],
  },),
  //endregion Inline sidebar

  //region Popover panel -- see side-drawer-styles-panel.ts
  SIDE_DRAWER_PANEL_STYLES,
  //endregion Popover panel
]
  .join('',);
