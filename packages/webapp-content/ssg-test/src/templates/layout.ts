/**
 * Full page layout template.
 *
 * Composes `<head>`, `<site-header>`, `<page-content>`, and `<site-footer>`
 * into a complete HTML document. All markup generated via h-html and
 * colocated component render functions — no raw HTML strings or template files.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { html as pageContentHtml, } from '../components/page-content.ts';
import { html as siteFooterHtml, } from '../components/site-footer.ts';
import { html as siteHeaderHtml, } from '../components/site-header.ts';
import type { Locales, } from '../i18n/i18n-types.ts';

import { headFragment, } from './head.ts';

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
            siteHeaderHtml(lang,),
            pageContentHtml({
              content,
              searchable,
            },),
            siteFooterHtml(),
          ],
        },),
      ],
    },)
  }`;
}
