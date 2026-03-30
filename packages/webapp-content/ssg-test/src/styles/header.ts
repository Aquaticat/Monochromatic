/**
 * Header bar and interactive element styles.
 *
 * Includes the site header, search popover, `:focus-visible` outlines,
 * and minimum touch target sizing for accessible interactive elements.
 */
import {
  $,
  cssCalc,
  cssPercent,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';

import {
  BORDER_WIDTH_REM,
  FULL_WIDTH,
  GAP,
  GAP_SMALL,
  MAX_WIDTH,
  TOUCH_TARGET,
} from './constants.ts';

/**
 * Site header bar styles.
 *
 * @returns CSS string for header rules
 */
export function headerStyles(): string {
  return [
    $({
      rule: 'header',
      decls: {
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        'padding-block': cssRem(GAP,),
        'padding-inline': cssRem(GAP,),
        'border-block-end-style': 'solid',
        'border-block-end-width': cssCalc(BORDER_WIDTH_REM,),
        'border-block-end-color': cssVar('color-border',),
      },
    },),
    $({
      rule: '.brand',
      decls: {
        display: 'flex',
        'align-items': 'center',
        gap: cssRem(GAP_SMALL,),
        'text-decoration-line': 'none',
        color: 'inherit',
        'font-weight': 600,
      },
    },),
    $({
      rule: '.brand img',
      decls: {
        'inline-size': cssRem(2,),
        'block-size': cssRem(2,),
      },
    },),
  ]
    .join('\n',);
}

/**
 * Search popover and interactive element styles.
 *
 * @returns CSS string for search and interaction rules
 */
export function searchAndInteractionStyles(): string {
  return [
    $({
      rule: '[popover]',
      decls: {
        'padding-block': cssRem(GAP,),
        'padding-inline': cssRem(GAP,),
        'max-inline-size': cssRem(MAX_WIDTH,),
        'border-style': 'solid',
        'border-width': cssCalc(BORDER_WIDTH_REM,),
        'border-color': cssVar('color-border',),
        'border-radius': cssRem(GAP_SMALL,),
      },
    },),
    $({
      rule: '[popover] input[type="search"]',
      decls: {
        'inline-size': cssPercent(FULL_WIDTH,),
        'padding-block': cssRem(GAP_SMALL,),
        'padding-inline': cssRem(GAP_SMALL,),
        'font-size': cssRem(1,),
      },
    },),
    $({
      rule: 'button, a',
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
