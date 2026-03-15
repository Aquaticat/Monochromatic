/**
 * New-task panel keyframe animation and positioning styles.
 */
import {
  cssCalc,
  cssCompounded,
  cssCubicBezier,
  cssDvb,
  cssOklch,
  cssPercent,
  cssRem,
  cssS,
  cssScale,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import { $ as css, } from './css.ts';

/** Keyframe animation and fixed-position styles for the new-task slide-up panel. */
export const newTaskPanel = [
  css({
    at: 'keyframes',
    params: 'fab-to-surface',
    children: [
      css({
        rule: 'from',
        decls: { transform: cssScale(0.15,), 'border-radius': cssPercent(50,),
          opacity: 0.6, },
      },),
      css({
        rule: 'to',
        decls: {
          transform: cssScale(1,),
          'border-start-start-radius': cssRem(1,),
          'border-start-end-radius': cssRem(1,),
          'border-end-start-radius': 0,
          'border-end-end-radius': 0,
          opacity: 1,
        },
      },),
    ],
  },),
  css({
    rule: '.new-task-panel',
    decls: {
      position: 'fixed',
      'inset-block-start': 'auto',
      'inset-block-end': 0,
      'inset-inline-start': 'auto',
      'inset-inline-end': cssRem(1,),
      'margin-block': 0,
      'margin-inline': 0,
      'border-style': 'none',
      'padding-block': 0,
      'padding-inline': 0,
      'background-color': cssVar('bg',),
      color: cssVar('fg',),
      'inline-size': cssCalc(`${cssRem(393,)} / 16`,),
      'max-block-size': cssDvb(80,),
      'overflow-y': 'auto',
      'border-start-start-radius': cssRem(1,),
      'border-start-end-radius': cssRem(1,),
      'border-end-start-radius': 0,
      'border-end-end-radius': 0,
      'box-shadow': cssCompounded([0, cssRem(-0.25,), cssRem(1,),
        cssOklch({ l: 0, c: 0, h: 0, a: 0.2, },),],),
      'transform-origin': cssCompounded(['bottom', 'right',],),
    },
    children: [
      css({
        rule: '&[data-animating]',
        decls: {
          'animation-name': 'fab-to-surface',
          'animation-duration': cssS(0.25,),
          'animation-timing-function': cssCubicBezier([0.4, 0, 0.2, 1,],),
          'animation-fill-mode': 'both',
        },
      },),
    ],
  },),
]
  .join('',);
