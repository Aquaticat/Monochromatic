/**
 * Composed CSS mixin patterns built on the primitives in `mixins.ts`.
 *
 * Separated to keep `mixins.ts` under the line budget.
 */
import type { CssDeclarations, } from '@monochromatic-dev/module-es/h-css';
import {
  cssCalc,
  cssInt,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import {
  flexCenter,
  flexRow,
  minTouchTarget,
} from './mixins.ts';

/**
 * Outlined interactive button with token-based colors.
 *
 * @returns Declarations for outlined button
 *
 * @example
 * ```ts
 * css({ rule: '.btn', decls: buttonOutlined() })
 * ```
 */
export function buttonOutlined(): CssDeclarations {
  return {
    ...flexCenter(),
    ...minTouchTarget(),
    gap: cssRem(0.5,),
    'border-width': cssCalc(`${cssRem(1,)} / 16`,),
    'border-style': 'solid',
    'border-color': cssVar('fg',),
    'padding-block': cssRem(0.5,),
    'padding-inline': cssRem(0.5,),
    'background-color': 'transparent',
    color: cssVar('fg',),
    'font-family': 'inherit',
    'font-size': 'inherit',
    'font-style': 'inherit',
    'font-weight': 'inherit',
    'line-height': 'inherit',
    cursor: 'pointer',
  };
}

/**
 * Top-anchored sticky navigation bar.
 *
 * @returns Declarations for sticky bar
 *
 * @example
 * ```ts
 * css({ rule: ':host', decls: { ...stickyBar(), 'justify-content': 'center' } })
 * ```
 */
export function stickyBar(): CssDeclarations {
  return {
    ...flexRow(),
    gap: cssVar('min-gap',),
    'block-size': cssRem(3,),
    'padding-block': 0,
    'padding-inline': cssVar('min-padding',),
    'background-color': cssVar('bg',),
    position: 'sticky',
    'inset-block-start': 0,
    'z-index': cssInt(10,),
  };
}
