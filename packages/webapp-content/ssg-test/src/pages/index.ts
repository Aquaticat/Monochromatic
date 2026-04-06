/**
 * Root index page — language picker.
 *
 * Renders a list of available languages linking to their landing pages.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import {
  i18nObject,
  locales,
} from '../i18n/i18n-util.ts';
import { pageLayout, } from '../templates/layout.ts';

/**
 * Generates the language picker page HTML.
 *
 * @param langs - available language codes
 *
 * @returns complete HTML document for the root index
 *
 * @example
 * ```ts
 * const html = indexPage(['en', 'fr']);
 * ```
 */
export function indexPage(langs: readonly string[],): string {
  /** Page title composed from all language translations of "choose a language". */
  const title = locales
    .map(function capitalize(locale,) {
      const str = i18nObject(locale,).chooseALang();
      return str.charAt(0,).toUpperCase() + str.slice(1,);
    },)
    .join(' ',);

  const content = h({
    tag: 'main',
    children: [
      h({
        tag: 'h1',
        text: title,
      },),
      h({
        tag: 'ul',
        children: langs.map(function langLink(lang,) {
          return h({
            tag: 'li',
            children: [h({
              tag: 'a',
              attrs: { href: `/${lang}`, },
              text: lang,
            },),],
          },);
        },),
      },),
    ],
  },);

  return pageLayout({
    title,
    lang: 'en',
    content,
  },);
}
