/**
 * Site header template with navigation, theme toggle, and search input.
 *
 * Renders the brand logo, site name, a theme inverse toggle (checkbox
 * styled as a button), and an expanding search input that collapses
 * to an icon when unfocused and expands on focus. Search results
 * appear in a dropdown below the input, powered by Pagefind.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type {
  Locales,
  TranslationFunctions,
} from '../i18n/i18n-types.ts';
import { i18nObject, } from '../i18n/i18n-util.ts';

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
 * Renders the site header with brand link, theme toggle, and expanding search input.
 *
 * The search input collapses to an icon-sized circle when unfocused and
 * expands to a full text input on focus. A results dropdown (`#search-results`)
 * is populated client-side by the Pagefind search module.
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
          searchInput(t,),
        ],
      },),
    ],
  },);
}

/**
 * Renders the expanding search input with results dropdown.
 *
 * The `<search>` landmark wraps an `<input type="search">` styled as an
 * icon when unfocused (via a background SVG of the search magnifying glass)
 * and an empty `<ul>` for Pagefind results populated client-side.
 *
 * @param t - translation functions for localized placeholder text
 *
 * @returns HTML string for the search widget
 */
function searchInput(t: TranslationFunctions,): string {
  return h({
    tag: 'search',
    class: 'site-search',
    children: [
      h({
        tag: 'input',
        attrs: {
          type: 'search',
          id: 'search-input',
          placeholder: t.searchPlaceholder(),
          autocomplete: 'off',
          'aria-label': t.searchPlaceholder(),
        },
        class: 'search-input',
      },),
      h({
        tag: 'ul',
        attrs: {
          id: 'search-results',
          role: 'listbox',
          'aria-label': t.searchPlaceholder(),
        },
        class: 'search-results',
      },),
    ],
  },);
}
