/**
 * Site header template with navigation, theme toggle, and search stub.
 *
 * Renders the brand logo, site name, a theme inverse toggle (checkbox
 * styled as a button), and a search popover that always displays empty
 * results (search is deferred).
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type {
  Locales,
  TranslationFunctions,
} from '../i18n/i18n-types.ts';
import { i18nObject, } from '../i18n/i18n-util.ts';

/**
 * Search icon SVG markup.
 *
 * Inline rather than imported because the icon is a single path element
 * too small to warrant a separate file and build-time import.
 */
const SEARCH_ICON = [
  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">',
  '<path d="M18.7441 19.0893L14.03 14.3752M16.8333 9.33333',
  'C16.8333 13.0152 13.8486 16 10.1667 16C6.48477 16',
  ' 3.5 13.0152 3.5 9.33333C3.5 5.65143 6.48477 2.66666',
  ' 10.1667 2.66666C13.8486 2.66666 16.8333 5.65143',
  ' 16.8333 9.33333Z" stroke="currentColor" stroke-width="2"/>',
  '</svg>',
]
  .join('',);

/**
 * Sun icon SVG markup for the light mode indicator.
 *
 * Shown when the theme is not inverted (default state).
 * Uses `currentColor` stroke to inherit the text color.
 */
const SUN_ICON = [
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
  '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>',
  '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41',
  'M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"',
  ' stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  '</svg>',
]
  .join('',);

/**
 * Moon icon SVG markup for the dark mode indicator.
 *
 * Shown when the theme is inverted (checked state).
 * Uses `currentColor` stroke to inherit the text color.
 */
const MOON_ICON = [
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
  '<path d="M21 12.79A9 9 0 1 1 11.21 3',
  ' 7 7 0 0 0 21 12.79z"',
  ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  '</svg>',
]
  .join('',);

/**
 * Renders the site header with brand link, theme toggle, and search stub.
 *
 * @param lang - current language code for localized text and links
 *
 * @returns HTML string for the `<header>` element
 *
 * @example
 * ```ts
 * const html = headerFragment('en');
 * ```
 */
export function headerFragment(lang: Locales,): string {
  const t = i18nObject(lang,);
  return h({
    tag: 'header',
    children: [
      h({
        tag: 'a',
        attrs: { href: `/${lang}`, },
        class: 'brand',
        children: [
          h({
            tag: 'img',
            attrs: {
              src: '/favicon.svg',
              alt: 'avatar',
            },
          },),
          h({
            tag: 'span',
            class: 'siteName',
            text: t.siteName(),
          },),
        ],
      },),
      h({
        tag: 'nav',
        children: [
          h({
            tag: 'input',
            attrs: {
              type: 'checkbox',
              id: 'theme-toggle',
            },
            class: 'theme-toggle-input',
          },),
          h({
            tag: 'label',
            attrs: {
              for: 'theme-toggle',
              'aria-label': t.themeToggle(),
            },
            class: 'theme-toggle',
            children: [
              h({
                tag: 'span',
                class: 'icon-light',
                html: SUN_ICON,
              },),
              h({
                tag: 'span',
                class: 'icon-dark',
                html: MOON_ICON,
              },),
            ],
          },),
          h({
            tag: 'button',
            attrs: { popovertarget: 'search', },
            children: [
              h({
                tag: 'span',
                text: 'Search',
              },),
              ` ${SEARCH_ICON}`,
            ],
          },),
          searchPopover(t,),
        ],
      },),
    ],
  },);
}

/**
 * Renders the search popover with input and empty results stub.
 *
 * @param t - translation functions for localized placeholder and labels
 *
 * @returns HTML string for the search popover
 */
function searchPopover(t: TranslationFunctions,): string {
  const placeholder = t.searchPlaceholder();

  return h({
    tag: 'div',
    attrs: {
      popover: '',
      id: 'search',
    },
    children: [
      h({
        tag: 'search',
        children: [
          h({
            tag: 'label',
            text: placeholder,
            children: [
              h({
                tag: 'input',
                attrs: {
                  name: 'q',
                  type: 'search',
                  required: '',
                  placeholder,
                },
              },),
            ],
          },),
        ],
      },),
      h({
        tag: 'p',
        text: t.noResults(),
      },),
    ],
  },);
}
