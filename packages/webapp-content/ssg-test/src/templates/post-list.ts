/**
 * Post list template.
 *
 * Renders a grid of post cards as an unordered list.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { Post, } from '../lib/content.ts';
import { postCard, } from './post-card.ts';

/**
 * Renders a `<ul>` grid of post cards.
 *
 * @param posts - posts to display
 *
 * @returns HTML string for the post list
 */
export function postList(posts: readonly Post[],): string {
  return h({
    tag: 'ul',
    class: 'Posts',
    children: posts.map(function renderCard(post,) {
      return postCard(post,);
    },),
  },);
}
