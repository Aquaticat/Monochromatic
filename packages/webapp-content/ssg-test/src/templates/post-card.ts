/**
 * Post card template.
 *
 * Renders a single blog post as a list item card with title,
 * description, tags, and date range.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type { Post, } from '../lib/content.ts';
import { prettyDate, } from './pretty-date.ts';

/**
 * Renders a post card `<li>` element.
 *
 * @param post - post data to render
 *
 * @returns HTML string for the post card
 */
export function postCard(post: Post,): string {
  const tagItems = post.data.tags.map(function renderTag(tag,) {
    return h({
      tag: 'li',
      class: 'Post__tag',
      children: [
        h({
          tag: 'a',
          attrs: { href: `#tag__${tag}`, },
          text: tag,
        },),
      ],
    },);
  },);

  return h({
    tag: 'li',
    class: 'Post',
    children: [
      h({
        tag: 'a',
        class: 'overlay',
        attrs: { href: `/${post.lang}/${post.name}`, },
        text: post.data.title,
      },),
      h({
        tag: 'div',
        class: 'content',
        children: [
          h({
            tag: 'h2',
            text: post.data.title,
          },),
          h({
            tag: 'p',
            class: 'description',
            text: post.data.description,
          },),
          h({
            tag: 'aside',
            children: [
              h({
                tag: 'ul',
                class: 'tags',
                children: tagItems,
              },),
              h({
                tag: 'span',
                class: 'date',
                children: [
                  prettyDate({
                    date: post.data.published,
                    lang: post.lang,
                  },),
                  ' - ',
                  prettyDate({
                    date: post.data.updated,
                    lang: post.lang,
                  },),
                ],
              },),
            ],
          },),
        ],
      },),
    ],
  },);
}
