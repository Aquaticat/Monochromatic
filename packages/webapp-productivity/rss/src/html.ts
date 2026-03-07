import { $ as binary, } from '@monochromatic-dev/module-es/binary';
import { $ as createObservableAsync, } from '@monochromatic-dev/module-es/create-observable-async';
import { $ as h, } from '@monochromatic-dev/module-es/h-html';
import { $ as mapIterableAsync, } from '@monochromatic-dev/module-es/map-iterable-async';
import { readFile, } from 'node:fs/promises';
import { readdir, } from 'node:fs/promises';
import type { ItemWDate, } from './item.ts';

import { css, } from './asset.ts';

import type { Dirent, } from 'node:fs';
import { join, } from 'node:path';
import { l, } from './log.ts';
import { IGNORE_PATH, } from './path.ts';

const LIMIT = 100;

/**
 * Closing HTML fragment appended to the rendered page.
 * Complements {@link indexHtmlBodyObservable} and the head fragment to form the full HTML document.
 */
export const INDEX_HTML_END = '</body></html>';

/**
 * Converts a feed item to an HTML string for display in the RSS reader interface.
 * Uses h-html to generate HTML strings for each feed item.
 * @param item - Feed item with publication date
 * @param index - Index of the item in the list (used for numbering)
 * @returns HTML string representing the feed item
 * @example
 * ```typescript
 * const items = getSortedItems(itemsWithDates);
 * const htmlItems = items.map(binary(itemToFeed));
 * ```
 * @see {@link ItemWDate} for the input type
 * @see {@link h} for string-based HTML element creation
 */
function itemToFeed({ item, pubDateDate, feed, }: ItemWDate, index: number,): string {
  l.debug(`itemToFeed ${item} ${pubDateDate} ${index}`);

  const descriptionIframe = item.description
    ? h({
      tag: 'iframe',
      class: 'feed__description',
      attrs: {
        src: `data:text/html;charset=utf-8,${
          encodeURIComponent(
            `<style>${css}</style>${(item.description as string | undefined) ?? ''}`,
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
                attrs: { href: item.link || '#', },
                text: item.title || 'Untitled',
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
                text: feed.title || 'Unknown',
              },),
              ...(feed.description
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
    ].filter(Boolean,),
  },);
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
    l.debug(`onLastUpdatedUpdate ${lastUpdated} ${old}`);
    if (lastUpdated.getTime() - old.getTime() < MIN_INTERVAL)
      l.warn(`onLastUpdatedUpdate successfully triggered, but too soon.`);
  },);

/**
 * Observable holding the current HTML body for the rendered feed list.
 * Set by {@link onItemsChange} after rendering the latest items.
 */
export const indexHtmlBodyObservable: {
  value: string;
} = await createObservableAsync(indexHtmlBody,
  function onIndexHtmlUpdate(indexHtml: string,) {
    l.debug(`onIndexHtmlUpdate ${indexHtml.slice(0, 100,)} ... ${indexHtml.slice(-100,)}`);
    lastUpdatedObservable.value = new Date();
  },);

/**
 * Re-renders the index HTML body from the provided items and updates {@link indexHtmlBodyObservable}.
 * @param items - Items with publication dates to render
 * @returns Promise that resolves when rendering completes and observable is updated
 */
export async function onItemsChange(items: ItemWDate[],): Promise<void> {
  l.debug(`onItemsChange`);

  indexHtmlBodyObservable.value = await getNewIndexHtmlBody(items,);

  l.debug(`onItemsChange `);
}

/**
 * Builds the HTML body string from items, filtering out ignored entries.
 * @param items - All available feed items with dates
 * @returns Promise resolving to the rendered HTML string for the feed list
 * @see {@link getJsons} for ignore list loading
 * @see {@link itemToFeed} for per-item rendering
 */
async function getNewIndexHtmlBody(items: ItemWDate[],): Promise<string> {
  l.debug(`getNewIndexHtmlBody`);

  const jsons = await getJsons();

  const filteredItems = items.filter(function notInJsons(item,) {
    const linkInJsons = jsons.some(function linkEqual(json,) {
      if (json.link && item.item.link) {
        l.trace(`json.link ${json.link} item.item.link ${item.item.link}`);
        return item.item.link === json.link;
      }
      return false;
    },);
    return ![linkInJsons,].some(Boolean,);
  },);

  l.debug(`filteredItems ${filteredItems.length} items ${items.length}`);

  const result = h({
    tag: 'ol',
    class: 'feeds',
    children: filteredItems.slice(0, LIMIT,).map(binary(itemToFeed,),),
  },);

  l.debug(`getNewIndexHtmlBody ${result.slice(0, 100,)} ... ${result.slice(-100,)}`);

  return result;
}

/**
 * Loads and parses all JSONL ignore files from the ignore directory.
 * @returns Promise resolving to an array of parsed JSON records
 * @see {@link IGNORE_PATH} for the ignore directory
 */
async function getJsons() {
  l.debug(`getJsons`);
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
        l.warn(`can't parse json ${jsonString} ${JSON.stringify(error,)}`);
        return DISCARD;
      }
    },)
    .filter(function notDiscard(value,) {
      return value !== DISCARD;
    },);
  l.debug(`getJsons ${jsons.at(-1,)} * ${jsons.length}`);
  return jsons;
}
