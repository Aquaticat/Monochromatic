/**
 * Root index page — language picker.
 *
 * Renders a list of available languages linking to their landing pages.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { i18n, } from '../lib/i18n.ts';
import { pageLayout, } from '../templates/layout.ts';

/**
 * Generates the language picker page HTML.
 *
 * @param langs - available language codes
 *
 * @returns complete HTML document for the root index
 */
export function indexPage(langs: string[],): string {
  /** Page title composed from all language translations of "choose a language". */
  const title = [...(i18n.get('chooseALang',)?.values() ?? []),]
    .map(function capitalize(str,) {
      return str.charAt(0,).toUpperCase() + str.slice(1,);
    },)
    .join(' ',);

  const content = h({
    tag: 'main',
    children: [
      h({ tag: 'h1', text: title, },),
      h({
        tag: 'ul',
        children: langs.map(function langLink(lang,) {
          return h({
            tag: 'li',
            children: [h({ tag: 'a', attrs: { href: `/${lang}`, }, text: lang, },),],
          },);
        },),
      },),
    ],
  },);

  return pageLayout({ title, lang: 'en', content, },);
}
