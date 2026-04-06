/**
 * Header bar, theme toggle, and interactive element styles.
 *
 * Includes the site header, theme inverse toggle, search popover,
 * `:focus-visible` outlines, and minimum touch target sizing for
 * accessible interactive elements.
 */
import {
  cssCalc,
  cssRem,
  cssVar,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

import {
  BORDER_WIDTH_REM,
  FONT_SIZE_SMALL,
  GAP,
  GAP_SMALL,
  TOUCH_TARGET,
} from './constants.ts';

/**
 * Site header bar styles.
 *
 * @returns CSS string for header rules
 *
 * @example
 * ```ts
 * const css = headerStyles();
 * ```
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
    $({
      rule: 'nav',
      decls: {
        display: 'flex',
        'align-items': 'center',
        gap: cssRem(GAP_SMALL,),
      },
    },),
  ]
    .join('\n',);
}

/**
 * Theme toggle checkbox-as-button styles.
 *
 * The real checkbox is visually hidden but remains focusable.
 * The adjacent label acts as the visible toggle with icon swap
 * driven by `:checked + label` selectors.
 *
 * @returns CSS string for theme toggle rules
 *
 * @example
 * ```ts
 * const css = themeToggleStyles();
 * ```
 */
export function themeToggleStyles(): string {
  return [
    $({
      rule: '.theme-toggle-input',
      decls: {
        position: 'absolute',
        'inline-size': cssCalc(BORDER_WIDTH_REM,),
        'block-size': cssCalc(BORDER_WIDTH_REM,),
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        'white-space': 'nowrap',
      },
    },),
    $({
      rule: '.theme-toggle',
      decls: {
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        'min-inline-size': cssRem(TOUCH_TARGET,),
        'min-block-size': cssRem(TOUCH_TARGET,),
        cursor: 'pointer',
      },
    },),
    $({
      rule: '.theme-toggle-input:focus-visible + .theme-toggle',
      decls: {
        'outline-color': cssVar('color-focus-ring',),
        'outline-style': 'solid',
        'outline-width': cssCalc(BORDER_WIDTH_REM,),
        'outline-offset': cssCalc(BORDER_WIDTH_REM,),
      },
    },),
    $({
      rule: '.theme-toggle .icon-dark',
      decls: {
        display: 'none',
      },
    },),
    $({
      rule: '.theme-toggle-input:checked + .theme-toggle .icon-light',
      decls: {
        display: 'none',
      },
    },),
    $({
      rule: '.theme-toggle-input:checked + .theme-toggle .icon-dark',
      decls: {
        display: 'inline',
      },
    },),
  ]
    .join('\n',);
}

/**
 * Search icon as a data URI for the collapsed input background.
 *
 * Uses `currentColor` equivalent (#666 for light, works in both modes via
 * the CSS custom property override on the input itself).
 * Encoded inline to avoid an extra network request for a 200-byte icon.
 */
const SEARCH_ICON_URI = [
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'",
  " viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M18.74 19.09",
  ' l-4.71-4.71M16.83 9.33A6.67 6.67 0 1 1 3.5 9.33',
  " a6.67 6.67 0 0 1 13.33 0z'",
  " stroke='%23888' stroke-width='2'/%3E%3C/svg%3E\")",
]
  .join('',);

/** Collapsed search input size in rem (matches touch target). */
const SEARCH_COLLAPSED = TOUCH_TARGET;

/** Expanded search input width in rem. */
const SEARCH_EXPANDED = 16;

/** Transition duration for the search input expand/collapse. */
const SEARCH_TRANSITION = '0.25s';

/**
 * Expanding search input and results dropdown styles.
 *
 * The input is icon-sized by default with the magnifying glass as a
 * centered background image. On `:focus` it expands, reveals
 * placeholder text, and shifts the icon to the inline-start edge.
 * The results dropdown positions absolutely below the search wrapper.
 *
 * @returns CSS string for search input and results rules
 *
 * @example
 * ```ts
 * const css = searchAndInteractionStyles();
 * ```
 */
export function searchAndInteractionStyles(): string {
  return [
    $({
      rule: '.site-search',
      decls: {
        position: 'relative',
        display: 'inline-flex',
        'align-items': 'center',
      },
    },),
    $({
      rule: '.search-input',
      decls: {
        'inline-size': cssRem(SEARCH_COLLAPSED,),
        'block-size': cssRem(SEARCH_COLLAPSED,),
        'padding-block': 0,
        'padding-inline': 0,
        'border-style': 'solid',
        'border-width': cssCalc(BORDER_WIDTH_REM,),
        'border-color': 'transparent',
        'border-radius': cssRem(SEARCH_COLLAPSED / 2,),
        'background-color': 'transparent',
        'background-image': SEARCH_ICON_URI,
        'background-repeat': 'no-repeat',
        'background-position': 'center',
        'background-size': cssRem(1.25,),
        color: cssVar('color-fg',),
        'font-size': cssRem(1,),
        cursor: 'pointer',
        'transition-property':
          'inline-size, padding-inline, border-color, background-color, background-position',
        'transition-duration': SEARCH_TRANSITION,
        'transition-timing-function': 'ease-out',
      },
    },),
    $({
      rule: '.search-input:focus',
      decls: {
        'inline-size': cssRem(SEARCH_EXPANDED,),
        'padding-inline-start': cssRem(2.5,),
        'padding-inline-end': cssRem(GAP_SMALL,),
        'border-color': cssVar('color-border',),
        'background-color': cssVar('color-bg',),
        'background-position': `${cssRem(GAP_SMALL,)} center`,
        'background-size': cssRem(1,),
        cursor: 'text',
        'outline-color': cssVar('color-focus-ring',),
        'outline-style': 'solid',
        'outline-width': cssCalc(BORDER_WIDTH_REM,),
        'outline-offset': cssCalc(BORDER_WIDTH_REM,),
      },
    },),
    $({
      rule: '.search-input::placeholder',
      decls: {
        color: 'transparent',
        'transition-property': 'color',
        'transition-duration': SEARCH_TRANSITION,
      },
    },),
    $({
      rule: '.search-input:focus::placeholder',
      decls: {
        color: cssVar('color-muted',),
      },
    },),
    $({
      rule: '.search-results',
      decls: {
        position: 'absolute',
        inset: `${cssRem(SEARCH_COLLAPSED,)} 0 auto auto`,
        'min-inline-size': cssRem(SEARCH_EXPANDED,),
        'max-block-size': cssRem(24,),
        'overflow-y': 'auto',
        'margin-block': 0,
        'padding-block': cssRem(GAP_SMALL,),
        'padding-inline': 0,
        'list-style-type': 'none',
        'background-color': cssVar('color-bg',),
        'border-style': 'solid',
        'border-width': cssCalc(BORDER_WIDTH_REM,),
        'border-color': cssVar('color-border',),
        'border-radius': cssRem(GAP_SMALL,),
        'box-shadow': `0 ${cssRem(GAP_SMALL,)} ${cssRem(GAP,)} rgba(0, 0, 0, 0.1)`,
        'z-index': '10',
      },
    },),
    $({
      rule: '.search-results:empty',
      decls: {
        display: 'none',
      },
    },),
    $({
      rule: '.search-results li',
      decls: {
        'padding-block': cssRem(GAP_SMALL,),
        'padding-inline': cssRem(GAP,),
      },
    },),
    $({
      rule: '.search-results li:hover, .search-results li[data-active]',
      decls: {
        'background-color': cssVar('color-code-bg',),
      },
    },),
    $({
      rule: '.search-results a',
      decls: {
        'text-decoration-line': 'none',
        color: 'inherit',
        display: 'block',
      },
    },),
    $({
      rule: '.search-results .search-title',
      decls: {
        'font-weight': '600',
      },
    },),
    $({
      rule: '.search-results .search-excerpt',
      decls: {
        'font-size': cssRem(FONT_SIZE_SMALL,),
        color: cssVar('color-muted',),
        'margin-block-start': cssRem(GAP_SMALL / 2,),
      },
    },),
    $({
      rule: '.search-results mark',
      decls: {
        'background-color': 'transparent',
        color: cssVar('color-link',),
        'font-weight': '600',
      },
    },),
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
