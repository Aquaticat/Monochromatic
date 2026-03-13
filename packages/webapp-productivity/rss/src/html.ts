// 168 lines: rendering and ignore-list loading share the item filtering context; both operate on ItemWDate
import { $ as binary, } from '@monochromatic-dev/module-es/binary';
import { $ as mapIterableAsync, } from '@monochromatic-dev/module-es/map-iterable-async';
import { $ as h, } from '@monochromatic-dev/module-es/h-html';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import type { Dirent, } from 'node:fs';
import { readFile, readdir, } from 'node:fs/promises';
import { join, } from 'node:path';
import { css, } from './asset.ts';
import type { ItemWDate, } from './item.ts';
import { l as parentLogger, } from './log.ts';
import { IGNORE_PATH, } from './path.ts';

/** Tagged logger for the html module. */
const l = tagged({ tag: 'html', l: parentLogger, },);

/** Maximum number of items rendered on a single page. */
const LIMIT = 100;

/** Closing HTML fragment appended after the rendered feed body. */
export const INDEX_HTML_END = '</body></html>';

//region Ignore content loading -- Reads raw JSONL content for salt derivation and link filtering

/**
 * Reads the raw text content of all ignore JSONL files.
 * Used both for content-derived memoize salt and for link filtering.
 *
 * @returns Concatenated raw text from all ignore files, or empty string if directory is missing
 */
export async function getIgnoreContent(): Promise<string> {
  const innerL = tagged({ tag: getIgnoreContent.name, l, },);
  let filesInDir: Dirent[] = [];
  try {
    filesInDir = await readdir(IGNORE_PATH, { withFileTypes: true, },);
  }
  catch {
    innerL.debug('ignore directory not found');
    return '';
  }
  const contents = await mapIterableAsync(
    async function readIgnoreFile(dirent: Dirent,) {
      return readFile(join(dirent.parentPath, dirent.name,), 'utf8',);
    },
    filesInDir,
  );
  return contents.join('',);
}

/**
 * Parses ignored links from raw ignore file content.
 *
 * @param content - Raw JSONL text from ignore files
 *
 * @returns Set of link URLs that should be excluded from rendering
 */
function parseIgnoredLinks(content: string,): Set<string> {
  const innerL = tagged({ tag: parseIgnoredLinks.name, l, },);
  const links = new Set<string>();
  const lines = content.split('\n',)
    .map(function trimLine(line,) {
      return line.trim();
    },)
    .filter(function isTruthy(line,) {
      return line.length > 0;
    },);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line,) as Record<string, string>;
      if (parsed.link) links.add(parsed.link,);
    }
    catch (error) {
      innerL.warn(`invalid JSON in ignore file: ${line} ${JSON.stringify(error,)}`);
    }
  }
  innerL.debug(`${String(links.size)} ignored links`);
  return links;
}

//endregion Ignore content loading

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
    if (!item.item.link) return true;
    return !ignoredLinks.has(item.item.link,);
  },);

  innerL.debug(`${String(filteredItems.length)} of ${String(items.length)} items after filtering`);

  return h({
    tag: 'ol',
    class: 'feeds',
    children: filteredItems.slice(0, LIMIT,).map(binary(itemToFeed,),),
  },);
}

/**
 * Renders a single feed item as an HTML list item.
 *
 * @param item - Feed item with publication date
 *
 * @param index - Position in the rendered list (used for numbering)
 *
 * @returns HTML string for the feed item
 */
function itemToFeed({ item, pubDateDate, feed, }: ItemWDate, index: number,): string {
  const descriptionIframe = item.description
    ? h({
      tag: 'iframe',
      class: 'feed__description',
      attrs: {
        src: `data:text/html;charset=utf-8,${
          encodeURIComponent(
            `<style>${css}</style>${String(item.description ?? '')}`,
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
    ].filter(function isTruthy(value,) {
      return value !== '';
    },),
  },);
}

//endregion HTML rendering
