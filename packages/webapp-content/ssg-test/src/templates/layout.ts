/**
 * Full page layout template.
 *
 * Composes `<head>`, `<header>`, and page-specific content into a
 * complete HTML document. All markup generated via h-html — no raw
 * HTML strings or template files.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { Locales, } from '../i18n/i18n-types.ts';

import { headFragment, } from './head.ts';
import { headerFragment, } from './header.ts';

/**
 * Renders a complete HTML document with the standard site shell.
 *
 * @param title - page title (prepended to site name in `<title>`)
 *
 * @param lang - language code for `<html lang>` and localized elements
 *
 * @param content - inner HTML to place between header and footer
 *
 * @returns complete HTML document string including `<!DOCTYPE html>`
 */
export function pageLayout(
  {
    title,
    lang,
    content,
  }: {
    title: string;
    lang: Locales;
    content: string
  },
): string {
  return `<!DOCTYPE html>\n${
    h({
      tag: 'html',
      attrs: { lang, },
      children: [
        headFragment({
          title,
          lang,
        },),
        h({
          tag: 'body',
          children: [
            headerFragment(lang,),
            h({
              tag: 'div',
              class: 'between_header_footer',
              html: content,
            },),
            h({ tag: 'footer', },),
          ],
        },),
      ],
    },)
  }`;
}
