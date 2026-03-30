/**
 * Full post page.
 *
 * Renders a complete blog post with its MDX-processed HTML content,
 * or a fallback link to the language chooser if the post does not
 * exist in the requested language.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

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
 * @returns complete HTML document for the post page
 */
export function postPage(
  {
    post,
    lang,
    name,
    renderedHtml,
  }: {
    post: Post | undefined;
    lang: Locales;
    name: string;
    renderedHtml: string | undefined;
  },
): string {
  if (post === undefined || renderedHtml === undefined) {
    return postNotFoundPage({
      lang,
      name,
    },);
  }

  const content = h({
    tag: 'main',
    children: [
      h({
        tag: 'h1',
        text: post.data.title,
      },),
      h({
        tag: 'article',
        html: renderedHtml,
      },),
    ],
  },);

  return pageLayout({
    title: post.data.title,
    lang,
    content,
  },);
}

/**
 * Renders a fallback page when a post does not exist in the requested language.
 *
 * @param lang - requested language code
 *
 * @param name - post slug name for the language chooser link
 *
 * @returns complete HTML document with redirect link
 */
function postNotFoundPage(
  {
    lang,
    name,
  }: {
    lang: Locales;
    name: string;
  },
): string {
  const t = i18nObject(lang,);
  const title = t.postNotInLang();

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
  },);
}
