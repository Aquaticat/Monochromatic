/**
 * Full page layout template.
 *
 * Composes `<head>`, `<header>`, and page-specific content into a
 * complete HTML document. All markup generated via h-html — no raw
 * HTML strings or template files.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type { Locales, } from '../i18n/i18n-types.ts';

import { footerFragment, } from './footer.ts';
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
 * @param description - page-specific meta description
 *
 * @param canonicalUrl - full canonical URL for this page
 *
 * @param searchable - whether pagefind should index this page's content
 *
 * @returns complete HTML document string including `<!DOCTYPE html>`
 *
 * @example
 * ```ts
 * const html = pageLayout({
 *   title: 'Home',
 *   lang: 'en',
 *   content: '<p>Hello</p>',
 *   description: 'Welcome',
 *   canonicalUrl: 'https://aquati.cat/en/',
 * });
 * ```
 */
export function pageLayout(
  {
    title,
    lang,
    content,
    description,
    canonicalUrl,
    searchable = false,
  }: {
    title: string;
    lang: Locales;
    content: string;
    description: string;
    canonicalUrl: string;
    searchable?: boolean;
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
          description,
          canonicalUrl,
        },),
        h({
          tag: 'body',
          children: [
            headerFragment(lang,),
            h({
              tag: 'div',
              class: 'between_header_footer',
              attrs: searchable ? { 'data-pagefind-body': '', } : {},
              html: content,
            },),
            footerFragment(),
          ],
        },),
      ],
    },)
  }`;
}
