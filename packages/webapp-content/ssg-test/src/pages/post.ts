/**
 * Full post page.
 *
 * Renders a complete blog post with its MDX-processed HTML content,
 * or a fallback link to the language chooser if the post does not
 * exist in the requested language.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type { Locales, } from '../i18n/i18n-types.ts';
import { i18nObject, } from '../i18n/i18n-util.ts';

import type { Post, } from '../lib/content.ts';
import { pageLayout, } from '../templates/layout.ts';

/**
 * Generates the full post page HTML.
 *
 * @param post - post data (or `undefined` if not available in this language)
 *
 * @param lang - requested language code
 *
 * @param name - post slug name (for fallback link)
 *
 * @param renderedHtml - pre-rendered MDX HTML content (from cache or processor)
 *
 * @param canonicalUrl - full canonical URL for this page
 *
 * @param availableInLangs - locales in which this post slug exists;
 * forwarded to the layout so the language switcher can produce
 * same-post links and fall back where translations are missing
 *
 * @returns complete HTML document for the post page
 *
 * @example
 * ```ts
 * const html = postPage({
 *   post,
 *   lang: 'en',
 *   name: 'hello',
 *   renderedHtml: '<p>Hi</p>',
 *   canonicalUrl: 'https://aquati.cat/en/hello',
 *   availableInLangs: ['en', 'ca'],
 * });
 * ```
 */
export function postPage(
  {
    post,
    lang,
    name,
    renderedHtml,
    canonicalUrl,
    availableInLangs,
  }: {
    readonly post?: Post;
    readonly lang: Locales;
    readonly name: string;
    readonly renderedHtml?: string;
    readonly canonicalUrl: string;
    readonly availableInLangs: readonly Locales[];
  },
): string {
  if ((post === undefined) || (renderedHtml === undefined)) {
    return postNotFoundPage({
      lang,
      name,
      canonicalUrl,
      availableInLangs,
    },);
  }

  /** Main element tree composed before the page layout wraps it with `<head>` and friends. */
  const content = h({
    tag: 'main',
    children: [
      h({
        tag: 'h1',
        text: post.data
          .title,
      },),
      h({
        tag: 'article',
        html: renderedHtml,
      },),
    ],
  },);

  return pageLayout({
    title: post.data
      .title,
    lang,
    content,
    description: post.data
      .description,
    canonicalUrl,
    searchable: true,
    currentName: name,
    availableInLangs,
  },);
}

/**
 * Renders a fallback page when a post does not exist in the requested language.
 *
 * @param lang - requested language code
 *
 * @param name - post slug name for the language chooser link
 *
 * @param canonicalUrl - full canonical URL for this page
 *
 * @param availableInLangs - locales in which this post slug exists;
 * forwarded so the language switcher highlights translations that
 * do exist even though the requested one does not
 *
 * @returns complete HTML document with redirect link
 */
function postNotFoundPage(
  {
    lang,
    name,
    canonicalUrl,
    availableInLangs,
  }: {
    readonly lang: Locales;
    readonly name: string;
    readonly canonicalUrl: string;
    readonly availableInLangs: readonly Locales[];
  },
): string {
  /** Locale-bound translator reused for fallback page strings. */
  const t = i18nObject(lang,);
  /** Heading naming the missing-translation condition for the requested locale. */
  const title = t.postNotInLang();

  /** Main element tree composed before the page layout wraps it with `<head>` and friends. */
  const content = h({
    tag: 'main',
    children: [
      h({
        tag: 'h1',
        text: title,
      },),
      h({
        tag: 'p',
        children: [
          `${t.redirectingToLangChooser()} `,
          h({
            tag: 'a',
            attrs: { href: `/${name}`, },
            text: name,
          },),
        ],
      },),
    ],
  },);

  return pageLayout({
    title,
    lang,
    content,
    description: t.postNotInLang(),
    canonicalUrl,
    currentName: name,
    availableInLangs,
  },);
}
