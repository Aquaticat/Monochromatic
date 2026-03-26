/**
 * CSS styles for the doodle widget.
 *
 * Uses h-css for type-safe CSS generation with strict property validation.
 */
import {
  $,
  cssNum,
  cssOklch,
} from '@monochromatic-dev/module-es/h-css';
import {
  FULL_DVB,
  FULL_PERCENT,
  INSET_ZERO_DECLS,
} from './style-tokens.ts';
import { renderTextStyles, } from './styles-text.ts';
import { renderToastStyles, } from './styles-toast.ts';
import { renderToolbarStyles, } from './styles-toolbar.ts';

/**
 * Generates the complete CSS stylesheet for the doodle widget.
 *
 * @returns minified CSS string
 */
export function renderStyles(): string {
  return [
    $({
      rule: '*, *::before, *::after',
      decls: {
        'box-sizing': 'border-box',
        'margin-block': cssNum(0,),
        'margin-inline': cssNum(0,),
      },
    },),

    $({
      rule: '#app',
      decls: {
        display: 'flex',
        'flex-direction': 'column',
        'block-size': FULL_DVB,
      },
    },),

    ...renderToolbarStyles(),

    $({
      rule: '#canvas-container',
      decls: {
        position: 'relative',
        'flex-grow': cssNum(1,),
        'overflow-x': 'clip',
        'overflow-y': 'clip',
        'background-color': cssOklch({
          l: 1,
          c: 0,
          h: 0,
        },),
      },
    },),

    $({
      rule: '#zoom-layer',
      decls: { ...INSET_ZERO_DECLS, },
    },),

    $({
      rule: '#draw-canvas',
      decls: {
        ...INSET_ZERO_DECLS,
        display: 'block',
        cursor: 'crosshair',
        'touch-action': 'none',
        '-webkit-touch-callout': 'none',
      },
    },),

    $({
      rule: '#svg-overlay',
      decls: {
        ...INSET_ZERO_DECLS,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'pointer-events': 'none',
        'mix-blend-mode': 'multiply',
      },
    },),

    $({
      rule: '#svg-overlay > svg',
      decls: {
        'max-inline-size': FULL_PERCENT,
        'max-block-size': FULL_PERCENT,
      },
    },),

    ...renderTextStyles(),

    ...renderToastStyles(),
  ]
    .join('',);
}
