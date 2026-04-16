/**
 * HTML `<head>` template.
 *
 * Renders meta tags, title, favicon link, and CSS stylesheet reference.
 * No inline CSS or large strings — styles are in a generated external file.
 * Element order follows Capo.js recommendations for optimal browser parsing.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type { Locales, } from '../i18n/i18n-types.ts';
import { i18nObject, } from '../i18n/i18n-util.ts';

/**
 * Renders the `<head>` element with meta, title, and stylesheet link.
 *
 * Elements are ordered per Capo.js priorities for optimal browser parsing:
 * pragma directives (11: charset, viewport) > title (10) > stylesheet (4)
 * > preload (3) > module script (2) > other meta/links (0).
 *
 * @param title - page-specific title (prepended to site name)
 *
 * @param lang - current language code for site name lookup
 *
 * @param description - page-specific meta description
 *
 * @param canonicalUrl - full canonical URL for this page
 *
 * @returns HTML string for the `<head>` element
 *
 * @example
 * ```ts
 * const head = headFragment({
 *   title: 'Home',
 *   lang: 'en',
 *   description: 'Welcome to the site',
 *   canonicalUrl: 'https://aquati.cat/en/',
 * });
 * ```
 */
export function headFragment(
  {
    title,
    lang,
    description,
    canonicalUrl,
  }: {
    title: string;
    lang: Locales;
    description: string;
    canonicalUrl: string;
  },
): string {
  const t = i18nObject(lang,);
  const fullTitle = `${title} | ${t.siteName()}`;

  return h({
    tag: 'head',
    children: [
      //region Capo.js priority 11 — pragma directives
      h({
        tag: 'meta',
        attrs: { charset: 'utf8', },
      },),
      h({
        tag: 'meta',
        attrs: {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
      },),
      //endregion
      //region Capo.js priority 10 — title
      h({
        tag: 'title',
        text: fullTitle,
      },),
      //endregion
      //region Capo.js priority 4 — sync CSS
      h({
        tag: 'link',
        attrs: {
          rel: 'stylesheet',
          href: '/styles.css',
        },
      },),
      //endregion
      //region Capo.js priority 3 — preload
      h({
        tag: 'link',
        attrs: {
          rel: 'preload',
          href: '/inter.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
      },),
      h({
        tag: 'link',
        attrs: {
          rel: 'preload',
          href: '/interItalic.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
      },),
      h({
        tag: 'link',
        attrs: {
          rel: 'preload',
          href: '/monaspaceNeon.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
      },),
      h({
        tag: 'link',
        attrs: {
          rel: 'preload',
          href: '/materialSymbols.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
      },),
      //endregion
      //region Capo.js priority 2 — deferred scripts (type=module is implicitly deferred)
      h({
        tag: 'script',
        attrs: {
          type: 'module',
          src: '/client/index.js',
        },
      },),
      //endregion
      //region Capo.js priority 0 — remaining meta and links
      h({
        tag: 'meta',
        attrs: {
          name: 'color-scheme',
          content: 'light dark',
        },
      },),
      h({
        tag: 'meta',
        attrs: {
          name: 'theme-color',
          content: '#bf97e3',
          media: '(prefers-color-scheme: light)',
        },
      },),
      h({
        tag: 'meta',
        attrs: {
          name: 'theme-color',
          content: '#4e318f',
          media: '(prefers-color-scheme: dark)',
        },
      },),
      h({
        tag: 'meta',
        attrs: {
          name: 'description',
          content: description,
        },
      },),
      h({
        tag: 'link',
        attrs: {
          rel: 'canonical',
          href: canonicalUrl,
        },
      },),
      h({
        tag: 'link',
        attrs: {
          rel: 'icon',
          href: '/favicon.ico',
          sizes: '32x32',
        },
      },),
      h({
        tag: 'link',
        attrs: {
          rel: 'icon',
          href: '/favicon.svg',
          type: 'image/svg+xml',
        },
      },),
      h({
        tag: 'link',
        attrs: {
          rel: 'apple-touch-icon',
          href: '/apple-touch-icon.png',
        },
      },),
      h({
        tag: 'link',
        attrs: {
          rel: 'manifest',
          href: '/manifest.webmanifest',
        },
      },),
      //endregion
    ],
  },);
}
