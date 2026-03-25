/**
 * Language landing page.
 *
 * Shows the site description as heading and a grid of all posts
 * available in the given language.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { Locales, } from '../i18n/i18n-types.ts';
import { i18nObject, } from '../i18n/i18n-util.ts';

import type { Post, } from '../lib/content.ts';
import { pageLayout, } from '../templates/layout.ts';
import { postList, } from '../templates/post-list.ts';

/**
 * Generates the language landing page HTML.
 *
 * @param lang - language code
 *
 * @param posts - posts filtered to this language
 *
 * @returns complete HTML document for the language landing page
 */
export function langPage(
  {
    lang,
    posts,
  }: {
    lang: Locales;
    posts: readonly Post[]
  },
): string {
  const t = i18nObject(lang,);
  const title = t.siteDescription();

  const content = [
    h({
      tag: 'main',
      children: [h({ tag: 'h1', text: title, },),],
    },),
    h({
      tag: 'aside',
      html: postList(posts,),
    },),
  ]
    .join('',);

  return pageLayout({
    title,
    lang,
    content,
  },);
}
