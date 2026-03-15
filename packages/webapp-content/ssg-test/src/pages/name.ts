/**
 * Post language chooser page.
 *
 * When a post exists in multiple languages, this page lists all
 * available language versions so the reader can pick one.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

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
  { name, posts, }: { name: string; posts: Post[]; },
): string {
  const content = h({
    tag: 'main',
    children: [
      h({ tag: 'h1', text: name, },),
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

  return pageLayout({ title: name, lang: 'en', content, },);
}
