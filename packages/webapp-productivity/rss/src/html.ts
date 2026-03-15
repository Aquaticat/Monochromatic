import { $ as h, } from '@monochromatic-dev/module-es/h-html';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import { css, } from './asset.ts';
import { getIgnoreContent, parseIgnoredLinks, } from './ignore.ts';
import type { ItemWDate, } from './item-type.ts';
import { l as parentLogger, } from './log.ts';

/** Tagged logger for the html module. */
const l = tagged({ tag: 'html', l: parentLogger, },);

/** Maximum number of items rendered on a single page. */
const LIMIT = 100;

/** Closing HTML fragment appended after the rendered feed body. */
export const INDEX_HTML_END = '</body></html>';

//region HTML rendering -- Converts feed items to HTML, filtering out ignored entries

/**
 * Builds the HTML body from items, filtering out entries present in the ignore list.
 *
 * @param options - Feed items with publication dates to render
 *
 * @returns Rendered HTML string for the feed list
 *
 * @example
 * ```ts
 * const body = await getIndexHtmlBody({ items });
 * ```
 */
export async function getIndexHtmlBody(options: { items: ItemWDate[]; }): Promise<string> {
  const { items, } = options;
  const innerL = tagged({ tag: getIndexHtmlBody.name, l, },);

  const ignoreContent = await getIgnoreContent();
  const ignoredLinks = parseIgnoredLinks(ignoreContent,);
  const filteredItems = items.filter(function notIgnored(item,) {
    if (item.item.link === undefined || item.item.link === '') return true;
    return !ignoredLinks.has(item.item.link,);
  },);

  innerL.debug(`${String(filteredItems.length)} of ${String(items.length)} items after filtering`);

  return h({
    tag: 'ol',
    class: 'feeds',
    children: filteredItems.slice(0, LIMIT,).map(function renderItem(item, index,) {
      return itemToFeed(item, index,);
    },),
  },);
}

/**
 * Renders a single feed item as an HTML list item.
 *
 * @param itemWDate - Feed item with publication date and feed metadata
 *
 * @param index - Position in the rendered list (used for numbering)
 *
 * @returns HTML string for the feed item
 */
function itemToFeed(itemWDate: ItemWDate, index: number,): string {
  const { item, pubDateDate, feed, } = itemWDate;
  const descriptionIframe = item.description !== undefined && item.description !== ''
    ? h({
      tag: 'iframe',
      class: 'feed__description',
      attrs: {
        src: `data:text/html;charset=utf-8,${
          encodeURIComponent(
            `<style>${css}</style>${String(item.description)}`,
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
    ].filter(function isTruthy(value,) {
      return value !== '';
    },),
  },);
}

//endregion HTML rendering
