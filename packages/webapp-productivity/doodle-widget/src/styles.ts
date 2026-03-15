/**
 * CSS styles for the doodle widget.
 *
 * Uses h-css for type-safe CSS generation with strict property validation.
 * Raw CSS strings handle px values and properties outside the strict type system.
 */
import {
  $,
  cssNum,
  cssOklch,
  type CssValue,
} from '@monochromatic-dev/module-es/h-css';
import {
  BORDER_COLOR,
  FULL_DVB,
  FULL_PERCENT,
} from './style-tokens.ts';
import { renderToolbarStyles, } from './styles-toolbar.ts';

/**
 * Generates the complete CSS stylesheet for the doodle widget.
 *
 * @returns minified CSS string
 */
export function renderStyles(): string {
  return [
    $({ rule: '*, *::before, *::after',
      raw: 'box-sizing:border-box;margin-block:0;margin-inline:0', },),

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
        position: 'absolute',
        display: 'block',
        cursor: 'crosshair',
        'touch-action': 'none',
      },
      raw: ';inset-block:0;inset-inline:0',
    },),

    $({
      rule: '#svg-overlay',
      decls: {
        position: 'absolute',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'pointer-events': 'none',
      },
      raw: ';inset-block:0;inset-inline:0',
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
        position: 'absolute',
        'pointer-events': 'none',
      },
      raw: ';inset-block:0;inset-inline:0',
    },),

    $({
      rule: '.text-input',
      decls: {
        position: 'absolute',
        'background-color': cssOklch({ l: 1, c: 0, h: 0, a: 0.85, },),
        color: cssOklch({ l: 0.3, c: 0, h: 0, },),
        'pointer-events': 'auto',
      },
      raw:
        ';border:none;outline:none;font-family:system-ui,sans-serif;font-size:1.25rem;line-height:1.4;padding-block:0;padding-inline:0;min-inline-size:8rem',
    },),

    /** Finalized inputs look like plain text */
    $({
      rule: '.text-input:read-only',
      decls: {
        'background-color': 'transparent' as CssValue,
        'pointer-events': 'none',
      },
      raw: ';min-inline-size:0;cursor:default',
    },),
    //endregion Text overlay layer
  ]
    .join('',);
}
