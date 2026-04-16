/**
 * Global reset, typography, and interaction styles.
 *
 * Base rules that apply site-wide before any component styles.
 * All colors reference CSS custom properties defined in `tokens.ts`.
 */
import {
  cssCalc,
  cssCommaList,
  cssPercent,
  cssRem,
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

import {
  BORDER_WIDTH_REM,
  GAP,
  GAP_SMALL,
  LINE_HEIGHT,
  TOUCH_TARGET,
} from './constants.ts';

/**
 * Box-sizing reset and base body styles.
 *
 * @returns CSS string for reset rules
 *
 * @example
 * ```ts
 * const css = resetStyles();
 * ```
 */
export function resetStyles(): string {
  return [
    $({
      rule: '*, *::before, *::after',
      decls: { 'box-sizing': 'border-box', },
    },),
    $({
      rule: '[data-is]',
      decls: { display: 'contents', },
    },),
    $({
      rule: 'body',
      decls: {
        'margin-block': 0,
        'margin-inline': 0,
        'font-family': cssCommaList([
          'Inter',
          'system-ui',
          'sans-serif',
        ],),
        'line-height': LINE_HEIGHT,
        color: cssVar('color-fg',),
        'background-color': cssVar('color-bg',),
      },
    },),
    $({
      rule: 'img',
      decls: { 'max-inline-size': cssPercent(100,), },
    },),
  ]
    .join('\n',);
}

/**
 * Base typography for headings, links, and code blocks.
 *
 * @returns CSS string for typography rules
 *
 * @example
 * ```ts
 * const css = typographyStyles();
 * ```
 */
export function typographyStyles(): string {
  return [
    $({
      rule: 'a',
      decls: { color: cssVar('color-link',), },
      children: [
        $({
          rule: '&:visited',
          decls: { color: cssVar('color-link-visited',), },
        },),
      ],
    },),
    $({
      rule: 'code',
      decls: {
        'font-family': cssCommaList([
          '"Monaspace Neon"',
          'monospace',
        ],),
      },
    },),
    $({
      rule: 'pre',
      decls: {
        'padding-block': cssRem(GAP,),
        'padding-inline': cssRem(GAP,),
        'overflow-x': 'auto',
        'border-radius': cssRem(GAP_SMALL,),
        'background-color': cssVar('color-code-bg',),
      },
    },),
  ]
    .join('\n',);
}

/**
 * Global interactive element styles.
 *
 * Minimum touch targets for links and `:focus-visible` outlines
 * for all focusable elements. Applies site-wide, not scoped
 * to any single component.
 *
 * @returns CSS string for interaction rules
 *
 * @example
 * ```ts
 * const css = interactionStyles();
 * ```
 */
export function interactionStyles(): string {
  return [
    $({
      rule: 'a',
      decls: {
        'min-inline-size': cssRem(TOUCH_TARGET,),
        'min-block-size': cssRem(TOUCH_TARGET,),
      },
    },),
    $({
      rule: ':focus-visible',
      decls: {
        'outline-color': cssVar('color-focus-ring',),
        'outline-style': 'solid',
        'outline-width': cssCalc(BORDER_WIDTH_REM,),
        'outline-offset': cssCalc(BORDER_WIDTH_REM,),
      },
    },),
  ]
    .join('\n',);
}
