import {
  binary,
  createObservableAsync,
  mapIterableAsync,
} from '@monochromatic-dev/module-es';
import { readFile, } from 'node:fs/promises';
import { readdir, } from 'node:fs/promises';
import { h, } from 'preact';
import { render, } from 'preact-render-to-string';
import type { ItemWDate, } from './item.ts';

import { css, } from './asset.ts';

import type { Dirent, } from 'node:fs';
import { join, } from 'node:path';
import { lHtml as l, } from './log.ts';
import { IGNORE_PATH, } from './path.ts';

const LIMIT = 100;

/**
 * Closing HTML fragment appended to the rendered page.
 * Complements {@link indexHtmlBodyObservable} and the head fragment to form the full HTML document.
 */
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
        'div',
        { class: 'feed__metadata', 'data-display': 'contents', },
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

/**
 * Minimum interval between feed update operations, in milliseconds.
 * Enforced by server endpoints to limit update frequency.
 */
export const MIN_INTERVAL: number = 10 ** 5; // 100 seconds in milliseconds

const lastUpdated = new Date(0,);

/**
 * Observable holding the timestamp of the last successful HTML body update.
 * Updated whenever {@link indexHtmlBodyObservable} changes.
 */
export const lastUpdatedObservable: {
  value: Date;
} = await createObservableAsync(lastUpdated,
  function onLastUpdatedUpdate(lastUpdated, old,) {
    l.debug`onLastUpdatedUpdate ${lastUpdated} ${old}`;
    if (lastUpdated.getTime() - old.getTime() < MIN_INTERVAL)
      l.warn`onLastUpdatedUpdate successfully triggered, but too soon.`;
  },);

/**
 * Observable holding the current HTML body for the rendered feed list.
 * Set by {@link onItemsChange} after rendering the latest items.
 */
export const indexHtmlBodyObservable: {
  value: string;
} = await createObservableAsync(indexHtmlBody,
  function onIndexHtmlUpdate(indexHtml: string,) {
    l.debug`onIndexHtmlUpdate ${indexHtml.slice(0, 100,)} ... ${indexHtml.slice(-100,)}`;
    lastUpdatedObservable.value = new Date();
  },);

/**
 * Re-renders the index HTML body from the provided items and updates {@link indexHtmlBodyObservable}.
 * @param items - Items with publication dates to render
 * @returns Promise that resolves when rendering completes and observable is updated
 */
export async function onItemsChange(items: ItemWDate[],): Promise<void> {
  l.debug`onItemsChange`;

  indexHtmlBodyObservable.value = await getNewIndexHtmlBody(items,);

  l.debug`onItemsChange `;
}

async function getNewIndexHtmlBody(items: ItemWDate[],): Promise<string> {
  l.debug`getNewIndexHtmlBody`;

  const jsons = await getJsons();

  const filteredItems = items.filter(function notInJsons(item,) {
    const linkInJsons = jsons.some(function linkEqual(json,) {
      if (json.link && item.item.link) {
        l.trace`json.link ${json.link} item.item.link ${item.item.link}`;
        return item.item.link === json.link;
      }
      return false;
    },);
    return ![linkInJsons,].some(Boolean,);
  },);

  l.debug`filteredItems ${filteredItems.length} items ${items.length}`;

  const result = render(
    h(
      'ol',
      { class: 'feeds', },
      filteredItems.slice(0, LIMIT,).map(binary(itemToFeed,),),
    ),
  );
  l.debug`getNewIndexHtmlBody ${result.slice(0, 100,)} ... ${result.slice(-100,)}`;

  return result;
}
async function getJsons() {
  l.debug`getJsons`;
  const filesInDir = await readdir(IGNORE_PATH, { withFileTypes: true, },);
  const jsonls = await mapIterableAsync(
    async function getContent(fileInDir: Dirent,) {
      return await readFile(join(fileInDir.parentPath, fileInDir.name,), 'utf8',);
    },
    filesInDir,
  );

  const jsonStrings = jsonls
    .map(function toJsonStrings(jsonl,) {
      return jsonl.split('\n',);
    },)
    .flat()
    .map(function trimString(value,) {
      return value.trim();
    },)
    .filter(Boolean,);
  const DISCARD = Symbol('discard',);
  const jsons = jsonStrings
    .map(function toJson(jsonString,) {
      try {
        return JSON.parse(jsonString.trim(),) as Record<string, string>;
      }
      catch (error) {
        l.warn`can't parse json ${jsonString} ${JSON.stringify(error,)}`;
        return DISCARD;
      }
    },)
    .filter(function notDiscard(value,) {
      return value !== DISCARD;
    },);
  l.debug`getJsons ${jsons.at(-1,)} * ${jsons.length}`;
  return jsons;
}
