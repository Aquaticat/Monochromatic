/**
 * Post language chooser page.
 *
 * When a post exists in multiple languages, this page lists all
 * available language versions so the reader can pick one.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { Locales, } from '../i18n/i18n-types.ts';
import { isLocale, } from '../i18n/i18n-util.ts';

import type { Post, } from '../lib/content.ts';
import { pageLayout, } from '../templates/layout.ts';

/**
 * Generates the language chooser page for a specific post slug.
 *
 * @param name - post slug name
 *
 * @param posts - all language variants of this post
 *
 * @returns complete HTML document listing available translations
 */
export function namePage(
  {
    name,
    posts,
  }: {
    name: string;
    posts: readonly Post[];
  },
): string {
  const content = h({
    tag: 'main',
    children: [
      h({
        tag: 'h1',
        text: name,
      },),
      h({
        tag: 'ul',
        children: posts.map(function langVariant(post,) {
          return h({
            tag: 'li',
            children: [
              h({
                tag: 'a',
                attrs: { href: `/${post.lang}/${post.name}`, },
                text: post.data.title,
              },),
            ],
          },);
        },),
      },),
    ],
  },);

  /** Default to the first available translation's language, falling back to 'en'. */
  const [firstPost,] = posts;
  const lang: Locales = firstPost !== undefined && isLocale(firstPost.lang,)
    ? firstPost.lang
    : 'en';

  return pageLayout({
    title: name,
    lang,
    content,
  },);
}
