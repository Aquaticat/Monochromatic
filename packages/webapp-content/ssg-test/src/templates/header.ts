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
 * Material Symbols ligature name for the theme toggle icon.
 *
 * Uses `invert_colors` — a single icon that represents both light
 * and dark modes, replacing the previous sun/moon SVG pair.
 */
const THEME_ICON = 'invert_colors';

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
                class: 'material-symbols-outlined',
                text: THEME_ICON,
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
 * The `<search>` landmark wraps an `<input type="search">` that collapses
 * to icon size when unfocused, with a Material Symbols `search` icon
 * overlaid via absolute positioning, and an empty `<ul>` for Pagefind
 * results populated client-side.
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
          role: 'combobox',
          'aria-label': t.searchPlaceholder(),
          'aria-controls': 'search-results',
          'aria-expanded': 'false',
          'aria-autocomplete': 'list',
        },
        class: 'search-input',
      },),
      h({
        tag: 'span',
        class: 'material-symbols-outlined search-icon',
        attrs: { 'aria-hidden': 'true', },
        text: 'search',
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
