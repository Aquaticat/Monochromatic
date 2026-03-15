/**
 * Popover panel styles for the `<side-drawer>` web component.
 *
 * Covers the full-screen popover overlay, slide-in animation,
 * scrim fade-in, and the drawer panel itself.
 */
import { cssCubicBezier, cssInt, cssNum, cssPercent, cssRem, cssS, cssTranslateX, cssVar, cssVi } from "@monochromatic-dev/module-es/h-css";
import { $ as css } from "../css.ts";
import { flexColumn, shadowDomGlobals } from "../mixins.ts";

/** Popover panel styles and animations for `<side-drawer>`. */
export const SIDE_DRAWER_PANEL_STYLES = [
  css({
    rule: '.panel',
    decls: {
      position: 'fixed',
      'inset-block': 0,
      'inset-inline': 0,
      'margin-block': 0,
      'margin-inline': 0,
      'padding-block': 0,
      'padding-inline': 0,
      'border-style': 'none',
      'inline-size': cssPercent(100),
      'max-inline-size': cssPercent(100),
      'block-size': cssPercent(100),
      'max-block-size': cssPercent(100),
      'z-index': cssInt(100),
      display: 'flex',
      'background-color': 'transparent',
      'overflow-x': 'visible',
      'overflow-y': 'visible',
    },
  }),
  css({ rule: '.panel:not(:popover-open)', decls: { display: 'none' } }),
  css({
    at: 'keyframes',
    params: 'drawer-slide-in',
    children: [
      css({ rule: 'from', decls: { transform: cssTranslateX(cssPercent(-100)), opacity: 0 } }),
      css({ rule: 'to', decls: { transform: cssTranslateX(cssNum(0)), opacity: 1 } }),
    ],
  }),
  css({
    at: 'keyframes',
    params: 'scrim-fade-in',
    children: [
      css({ rule: 'from', decls: { 'background-color': 'transparent' } }),
      css({ rule: 'to', decls: { 'background-color': cssVar('overlay-bg') } }),
    ],
  }),
  css({
    rule: '.panel:popover-open',
    decls: {
      'animation-name': 'scrim-fade-in',
      'animation-duration': cssS(0.2),
      'animation-timing-function': 'ease-out',
      'animation-fill-mode': 'both',
    },
  }),
  css({
    rule: '.panel:popover-open > .panel-drawer',
    decls: {
      'animation-name': 'drawer-slide-in',
      'animation-duration': cssS(0.25),
      'animation-timing-function': cssCubicBezier([0, 0, 0.2, 1]),
      'animation-fill-mode': 'both',
    },
  }),
  css({
    rule: '.panel-drawer',
    decls: {
      'background-color': cssVar('bg'),
      'inline-size': cssRem(20),
      'max-inline-size': cssVi(85),
      'block-size': cssPercent(100),
      ...flexColumn(),
    },
  }),
  ...shadowDomGlobals(),
].join('');
