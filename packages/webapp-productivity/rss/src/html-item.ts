/** Renders a single RSS feed item as an HTML list-item element. */

import { $ as h, } from '@monochromatic-dev/module-es/h-html';
import { css, } from './asset.ts';
import type { ItemWDate, } from './item-type.ts';

/**
 * Renders a single feed item as an HTML list item.
 *
 * @param options - Feed item with its position in the rendered list
 *
 * @returns HTML string for the feed item
 *
 * @example
 * ```ts
 * const html = itemToFeed({ itemWDate: item, index: 0 });
 * ```
 */
export function itemToFeed(
  options: {
    itemWDate: ItemWDate;
    index: number;
  },
): string {
  const {
    itemWDate,
    index,
  } = options;
  const {
    item,
    pubDateDate,
    feed,
  } = itemWDate;
  const descriptionIframe = item.description !== undefined && item.description !== ''
    ? h({
      tag: 'iframe',
      class: 'feed__description',
      attrs: {
        src: `data:text/html;charset=utf-8,${
          encodeURIComponent(
            `<style>${css}</style>${String(item.description,)}`,
          )
        }`,
        sandbox: '',
      },
    },)
    : '';

  return h({
    tag: 'li',
    class: 'feed',
    attrs: { value: String(index,), },
    children: [
      h({
        tag: 'div',
        class: 'feed__metadata',
        attrs: { 'data-display': 'contents', },
        children: [
          h({
            tag: 'h2',
            class: 'feed__title',
            children: [
              h({
                tag: 'a',
                class: 'feed__link',
                attrs: { href: item.link ?? '#', },
                text: item.title ?? 'Untitled',
              },),
            ],
          },),
          h({
            tag: 'time',
            class: 'feed__date',
            attrs: { datetime: pubDateDate.toISOString(), },
            text: pubDateDate.toLocaleString(),
          },),
          h({
            tag: 'p',
            class: 'feed__source',
            children: [
              h({
                tag: 'span',
                class: 'feed__itemTitle',
                text: feed.title ?? 'Unknown',
              },),
              ...(feed.description !== undefined && feed.description !== ''
                ? [h({
                  tag: 'span',
                  class: 'feed__itemDescription',
                  text: feed.description,
                },),]
                : []),
            ],
          },),
        ],
      },),
      descriptionIframe,
    ]
      .filter(function isTruthy(value,) {
        return value !== '';
      },),
  },);
}
