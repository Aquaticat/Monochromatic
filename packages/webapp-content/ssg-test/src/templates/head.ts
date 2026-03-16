/**
 * HTML `<head>` template.
 *
 * Renders meta tags, title, favicon link, and CSS stylesheet reference.
 * No inline CSS or large strings — styles are in a generated external file.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { t, } from '../lib/i18n.ts';

/**
 * Renders the `<head>` element with meta, title, and stylesheet link.
 *
 * @param title - page-specific title (prepended to site name)
 *
 * @param lang - current language code for site name lookup
 *
 * @returns HTML string for the `<head>` element
 */
export function headFragment(
  { title, lang, }: { title: string; lang: string; },
): string {
  const fullTitle = `${title} | ${t('siteName', lang,)}`;

  return h({
    tag: 'head',
    children: [
      h({ tag: 'meta', attrs: { charset: 'utf8', }, },),
      h({ tag: 'meta', attrs: {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      }, },),
      h({ tag: 'link', attrs: {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '32x32',
      }, },),
      h({ tag: 'link', attrs: {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      }, },),
      h({ tag: 'link', attrs: {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      }, },),
      h({ tag: 'link', attrs: {
        rel: 'manifest',
        href: '/manifest.webmanifest',
      }, },),
      h({ tag: 'link', attrs: {
        rel: 'stylesheet',
        href: '/styles.css',
      }, },),
      h({ tag: 'title', text: fullTitle, },),
    ],
  },);
}
