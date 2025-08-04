import {
  binary,
  createObservableAsync,
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
  thunk,
} from '@monochromatic-dev/module-es';
import { h, } from 'preact';
import { render, } from 'preact-render-to-string';
import type { ItemWDate, } from './item.ts';
import { sortedItemsObservable, } from './item.ts';

import {
  css,
  js,
} from './asset.ts';

await logtapeConfigure(await logtapeConfiguration(),);

const l = logtapeGetLogger(['a', 'html',],);

const LIMIT = 100;

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
function itemToFeed({ item, pubDateDate, }: ItemWDate, index: number,) {
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
            item.title || 'Unknown',
          ),
          h(
            'span',
            { class: 'feed__itemDescription', },
            item.description || 'Unknown',
          ),
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

const indexHtml = `
  <!DOCTYPE html><html lang=en>
  <head>
  <meta charset=UTF-8>
  <meta name=viewport content='width=device-width,initial-scale=1.0'>
  <style>${css}</style>
  <script type=module>${js.replaceAll(/<\/script>/gvi, '<\\/script>',)}</script>
  </head>
  <body>
  ${
  render(
    h(
      'ol',
      { start: 0, class: 'feedList', },
      sortedItemsObservable.value.slice(0, LIMIT,).map(binary(itemToFeed,),),
    ),
  )
}
  </body>
  </html>
`;

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

export const indexHtmlObservable: {
  value: string;
} = await createObservableAsync(indexHtml,
  function onIndexHtmlUpdate(indexHtml: string,) {
    l.debug`onIndexHtmlUpdate ${indexHtml.slice(0, 100,)} ... ${indexHtml.slice(-100,)}`;
    lastUpdatedObservable.value = new Date();
  },);

export function onItemsChange(items: ItemWDate[],): void {
  l.debug`onItemsChange`;

  indexHtmlObservable.value = getNewIndexHtml(items,);

  l.debug`onItemsChange `;
}

function getNewIndexHtml(items: ItemWDate[],): string {
  l.debug`getNewIndexHtml`;
  const result = `
  <!DOCTYPE html><html lang=en>
  <head>
  <meta charset=UTF-8>
  <meta name=viewport content='width=device-width,initial-scale=1.0'>
  <style>${css}</style>
  <script type=module>${js.replaceAll(/<\/script>/gvi, '<\\/script>',)}</script>
  </head>
  <body>
  ${
    render(
      h(
        'ol',
        { start: 0, class: 'feedList', },
        items.slice(0, LIMIT,).map(binary(itemToFeed,),),
      ),
    )
  }
  </body>
  </html>
`;
  l.debug`getNewIndexHtml ${result.slice(0, 100,)} ... ${result.slice(-100,)}`;

  return result;
}
