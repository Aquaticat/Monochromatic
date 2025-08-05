import {
  binary,
  createObservableAsync,
} from '@monochromatic-dev/module-es';
import { h, } from 'preact';
import { render, } from 'preact-render-to-string';
import type { ItemWDate, } from './item.ts';

import { css, } from './asset.ts';

import { lHtml as l, } from './log.ts';

const LIMIT = 100;

export const INDEX_HTML_END = '</body></html>';

/**
 * Converts a feed item to HTML for display in the RSS reader interface.
 * Uses Preact to generate HTML elements for each feed item.
 * @param item - Feed item with publication date
 * @param index - Index of the item in the list (used for numbering)
 * @returns Preact JSX element representing the feed item
 * @example
 * ```typescript
 * const items = getSortedItems(itemsWithDates);
 * const htmlItems = items.map(itemToFeed);
 * ```
 * @see {@link ItemWDate} for the input type
 * @see {@link h} for Preact element creation
 * @see {@link render} for HTML rendering
 */
function itemToFeed({ item, pubDateDate, feed, }: ItemWDate, index: number,) {
  l.debug`itemToFeed ${item} ${pubDateDate} ${index}`;
  return h(
    'li',
    { value: index, class: 'feed', },
    [
      h(
        'h2',
        { class: 'feed__title', },
        [
          h(
            'a',
            { class: 'feed__link', href: item.link || '#', },
            item
              .title || 'Untitled',
          ),
        ],
      ),

      h(
        'time',
        { class: 'feed__date', datetime: pubDateDate.toISOString(), },
        pubDateDate.toLocaleString(),
      ),
      h(
        'p',
        { class: 'feed__source', },
        [
          h(
            'span',
            { class: 'feed__itemTitle', },
            feed.title || 'Unknown',
          ),
          feed.description
            ? h(
              'span',
              { class: 'feed__itemDescription', },
              feed.description,
            )
            : null,
        ],
      ),
      item.description
        ? h(
          'iframe',
          {
            class: 'feed__description',
            src: `data:text/html;charset=utf-8,${
              encodeURIComponent(
                `<style>${css}</style>${(item.description as string | undefined) ?? ''}`,
              )
            }`,
            sandbox: '',
          },
        )
        : null,
    ],
  );
}

const indexHtmlBody = '';

export const MIN_INTERVAL: number = 10 ** 5; // 100 seconds in milliseconds

const lastUpdated = new Date(0,);

export const lastUpdatedObservable: {
  value: Date;
} = await createObservableAsync(lastUpdated,
  function onLastUpdatedUpdate(lastUpdated, old,) {
    l.debug`onLastUpdatedUpdate ${lastUpdated} ${old}`;
    if (lastUpdated.getTime() - old.getTime() < MIN_INTERVAL)
      l.debug`onLastUpdatedUpdate successfully triggered, but too soon.`;
  },);

export const indexHtmlBodyObservable: {
  value: string;
} = await createObservableAsync(indexHtmlBody,
  function onIndexHtmlUpdate(indexHtml: string,) {
    l.debug`onIndexHtmlUpdate ${indexHtml.slice(0, 100,)} ... ${indexHtml.slice(-100,)}`;
    lastUpdatedObservable.value = new Date();
  },);

export function onItemsChange(items: ItemWDate[],): void {
  l.debug`onItemsChange`;

  indexHtmlBodyObservable.value = getNewIndexHtmlBody(items,);

  l.debug`onItemsChange `;
}

function getNewIndexHtmlBody(items: ItemWDate[],): string {
  l.debug`getNewIndexHtmlBody`;
  const result = render(
    h(
      'ol',
      { class: 'feeds', },
      items.slice(0, LIMIT,).map(binary(itemToFeed,),),
    ),
  );
  l.debug`getNewIndexHtmlBody ${result.slice(0, 100,)} ... ${result.slice(-100,)}`;

  return result;
}
