/**
 * Global reset, layout, and typography styles.
 *
 * Base rules that apply site-wide before any component styles.
 * All colors reference CSS custom properties defined in `tokens.ts`.
 */
import {
  $,
  cssCommaList,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

import {
  GAP,
  GAP_SMALL,
  LINE_HEIGHT,
  MAX_WIDTH,
} from './constants.ts';

/**
 * Box-sizing reset and base body styles.
 *
 * @returns CSS string for reset rules
 */
export function resetStyles(): string {
  return [
    $({ rule: '*, *::before, *::after', decls: { 'box-sizing': 'border-box', }, },),
    $({ rule: 'body', decls: {
      'margin-block': 0,
      'margin-inline': 0,
      'font-family': cssCommaList(['Inter', 'system-ui', 'sans-serif',],),
      'line-height': LINE_HEIGHT,
      color: cssVar('color-fg',),
      'background-color': cssVar('color-bg',),
    }, },),
  ].join('\n',);
}

/**
 * Content area layout constraints.
 *
 * @returns CSS string for layout rules
 */
export function layoutStyles(): string {
  return $({ rule: '.between_header_footer', decls: {
    'max-inline-size': cssRem(MAX_WIDTH,),
    'margin-inline': 'auto',
    'padding-inline': cssRem(GAP,),
    'padding-block': cssRem(GAP,),
  }, },);
}

/**
 * Base typography for headings, links, and code blocks.
 *
 * @returns CSS string for typography rules
 */
export function typographyStyles(): string {
  return [
    $({ rule: 'a', decls: { color: cssVar('color-link',), }, },),
    $({ rule: 'a:visited', decls: { color: cssVar('color-link-visited',), }, },),
    $({ rule: 'code', decls: { 'font-family': cssCommaList(['"Monaspace Neon"', 'monospace',],), }, },),
    $({ rule: 'pre', decls: {
      'padding-block': cssRem(GAP,),
      'padding-inline': cssRem(GAP,),
      'overflow-x': 'auto',
      'border-radius': cssRem(GAP_SMALL,),
      'background-color': cssVar('color-code-bg',),
    }, },),
  ].join('\n',);
}
