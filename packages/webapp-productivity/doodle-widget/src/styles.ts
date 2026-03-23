/**
 * CSS styles for the doodle widget.
 *
 * Uses h-css for type-safe CSS generation with strict property validation.
 */
import {
  $,
  cssCommaList,
  cssNum,
  cssOklch,
  cssRem,
} from '@monochromatic-dev/module-es/h-css';
import {
  FULL_DVB,
  FULL_PERCENT,
  INSET_ZERO_DECLS,
} from './style-tokens.ts';
import { renderToolbarStyles, } from './styles-toolbar.ts';

/** Text input minimum inline size in rem */
const TEXT_INPUT_MIN_INLINE_SIZE = 2 * 2 * 2;

/** Text input line height (wider than CSS normal ~1.2 for readability) */
const TEXT_INPUT_LINE_HEIGHT = 1 + 2 / (2 + 2 + 1);

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
      decls: { display: 'flex', 'flex-direction': 'column', 'block-size': FULL_DVB, },
    },),

    ...renderToolbarStyles(),

    $({
      rule: '#canvas-container',
      decls: {
        position: 'relative',
        'flex-grow': cssNum(1,),
        'overflow-x': 'clip',
        'overflow-y': 'clip',
        'background-color': cssOklch({ l: 1, c: 0, h: 0, },),
      },
    },),

    $({
      rule: '#draw-canvas',
      decls: {
        ...INSET_ZERO_DECLS,
        display: 'block',
        cursor: 'crosshair',
        'touch-action': 'none',
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
      },
    },),

    $({
      rule: '#svg-overlay > svg',
      decls: {
        'max-inline-size': FULL_PERCENT,
        'max-block-size': FULL_PERCENT,
      },
    },),

    //region Text overlay layer

    $({
      rule: '#text-layer',
      decls: {
        ...INSET_ZERO_DECLS,
        'pointer-events': 'none',
      },
    },),

    $({
      rule: '.text-input',
      decls: {
        position: 'absolute',
        'background-color': cssOklch({ l: 1, c: 0, h: 0, a: 0.85, },),
        color: cssOklch({ l: 0.3, c: 0, h: 0, },),
        'pointer-events': 'auto',
        'border-block-style': 'none',
        'border-inline-style': 'none',
        'outline-style': 'none',
        'font-family': cssCommaList(['system-ui', 'sans-serif',],),
        'font-size': cssRem(1 + 1 / 2 / 2,),
        'line-height': cssNum(TEXT_INPUT_LINE_HEIGHT,),
        'padding-block': cssNum(0,),
        'padding-inline': cssNum(0,),
        'min-inline-size': cssRem(TEXT_INPUT_MIN_INLINE_SIZE,),
      },
    },),

    /** Finalized inputs look like plain text */
    $({
      rule: '.text-input:read-only',
      decls: {
        'background-color': 'transparent',
        'pointer-events': 'none',
        'min-inline-size': cssNum(0,),
        cursor: 'default',
      },
    },),
    //endregion Text overlay layer
  ]
    .join('',);
}
