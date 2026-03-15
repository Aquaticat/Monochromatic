/**
 * Shadow DOM styles for the `<toggle-switch>` web component.
 */
import { cssCalc, cssCommaList, cssPercent, cssRem, cssS, cssTranslateY, cssVar } from "@monochromatic-dev/module-es/h-css";
import { $ as css } from "../css.ts";
import { borderRadiusFull, flexCenter } from "../mixins.ts";

/** Compiled CSS string for `<toggle-switch>` Shadow DOM. */
export const TOGGLE_SWITCH_STYLES = [
  css({
    rule: ':host',
    decls: {
      display: 'inline-flex',
      cursor: 'pointer',
      'inline-size': cssRem(3),
      'block-size': cssRem(2),
    },
  }),
  css({
    rule: '.track',
    decls: {
      'inline-size': cssPercent(100),
      'block-size': cssPercent(100),
      'border-width': cssCalc(`${cssRem(1)} / 16`),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      ...borderRadiusFull(),
      'background-color': cssVar('bg'),
      position: 'relative',
      'overflow-x': 'hidden',
      'overflow-y': 'hidden',
    },
  }),
  css({
    rule: '.thumb',
    decls: {
      position: 'absolute',
      'inset-block-start': cssPercent(50),
      transform: cssTranslateY(cssPercent(-50)),
      'inline-size': cssRem(2),
      'block-size': cssRem(2),
      ...borderRadiusFull(),
      'border-width': cssCalc(`${cssRem(1)} / 16`),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      'background-color': cssVar('bg-stronger'),
      ...flexCenter(),
      'font-size': cssRem(1),
      'transition-property': cssCommaList(['inset-inline-start', 'inset-inline-end']),
      'transition-duration': cssS(0.15),
    },
  }),
  css({
    rule: '.thumb.on',
    decls: {
      'inset-inline-end': cssCalc(`${cssRem(-1)} / 16`),
      'inset-inline-start': 'auto',
    },
  }),
  css({
    rule: '.thumb.off',
    decls: {
      'inset-inline-start': cssCalc(`${cssRem(-1)} / 16`),
      'inset-inline-end': 'auto',
    },
  }),
].join('');
