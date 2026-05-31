/**
 * Language landing page.
 *
 * Shows the site description as heading and a grid of all posts
 * available in the given language.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type { Locales, } from '../i18n/i18n-types.ts';
import { i18nObject, } from '../i18n/i18n-util.ts';

import { html as postListHtml, } from '../components/post-list.ts';
import type { Post, } from '../lib/content.ts';
import { pageLayout, } from '../templates/layout.ts';

/**
 * Generates the language landing page HTML.
 *
 * @param lang - language code
 *
 * @param posts - posts filtered to this language
 *
 * @param canonicalUrl - full canonical URL for this page
 *
 * @returns complete HTML document for the language landing page
 *
 * @example
 * ```ts
 * const html = langPage({ lang: 'en', posts: englishPosts, canonicalUrl: 'https://aquati.cat/en/' });
 * ```
 */
export function langPage(
  {
    lang,
    posts,
    canonicalUrl,
  }: {
    readonly lang: Locales;
    readonly posts: readonly Post[];
    readonly canonicalUrl: string;
  },
): string {
  /**
   * Locale-bound translator reused for both `<h1>` and head meta strings.
   */
  const t = i18nObject(lang,);
  /**
   * Page heading mirrors the site description for the language landing page.
   */
  const title = t.siteDescription();

  /**
   * Main element tree composed before the page layout wraps it with `<head>` and friends.
   */
  const content = h({
    tag: 'main',
    children: [
      h({
        tag: 'h1',
        text: title,
      },),
      h({
        tag: 'section',
        html: postListHtml(posts,),
      },),
    ],
  },);

  return pageLayout({
    title,
    lang,
    content,
    description: t.siteDescription(),
    canonicalUrl,
  },);
}
