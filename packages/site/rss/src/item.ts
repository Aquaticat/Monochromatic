import { createObservableAsync, } from '@monochromatic-dev/module-es';
import {
  parseAtomFeed,
  parseRssFeed,
} from 'feedsmith';
import type {
  Category,
  Link,
} from 'node_modules/feedsmith/dist/feeds/atom/parse/types';
import type { Outline, } from 'node_modules/feedsmith/dist/opml/parse/types';
import { z, } from 'zod/v4-mini';
import type { FeedWOutline, } from './feed.ts';
import { onItemsChange, } from './html.ts';
import { lItem as l, } from './log.ts';

/**
 * Type definition for individual feed items.
 * Combines feed metadata with individual item data.
 */
type Item = {
  feed: Omit<ReturnType<typeof parseRssFeed | typeof parseAtomFeed>, 'entries' | 'items'>;
  outline: Outline;
  item: NonNullable<
    ReturnType<typeof parseRssFeed>['items'] | ReturnType<typeof parseAtomFeed>['entries']
  >[number];
};

/**
 * Extracts individual items from feeds.
 * Handles both RSS and Atom feed formats with appropriate item extraction.
 * @param feeds - Array of feed objects with outlines
 * @returns Array of individual feed items
 * @example
 * ```typescript
 * const feeds = await getFeeds(innerOutlinesWUrl);
 * const items = getItems(feeds);
 * ```
 * @see {@link FeedWOutline} for the input type
 * @see {@link parseRssFeed} for RSS item structure
 * @see {@link parseAtomFeed} for Atom entry structure
 */
function getItems(feeds: FeedWOutline[],): Item[] {
  l.debug`getItems`;
  const DISCARD = Symbol('discard',);
  const result: Item[] = feeds
    .map(function _getItems({ feed, outline, },) {
      if (outline.type === 'atom') {
        const myFeed = feed as ReturnType<typeof parseAtomFeed>;
        const items = myFeed.entries;
        if (!items) {
          l.warn`${items} not found for atom feed ${feed}`;
          return DISCARD;
        }
        if (items.length === 0) {
          l.warn`${items} empty for atom feed ${feed}`;
          return DISCARD;
        }
        return items.map(function appendMetadata(item,) {
          return { feed: { ...myFeed, entries: DISCARD, }, outline, item, };
        },);
      }
      const myFeed = feed as ReturnType<typeof parseRssFeed>;
      const items = myFeed.items;
      if (!items) {
        l.warn`${items} not found for rss feed ${feed}`;
        return DISCARD;
      }
      if (items.length === 0) {
        l.warn`${items} empty for rss feed ${feed}`;
        return DISCARD;
      }
      return items.map(function appendMetadata(item,) {
        return { feed: { ...myFeed, items: DISCARD, }, outline, item, };
      },);
    },)
    .filter(function notDiscard(value,) {
      return value !== DISCARD;
    },)
    .flat();

  l.debug`getItems ${result[0]} * ${result.length}`;

  return result;
}

/**
 * Type definition for normalized feed items.
 * Standardizes item structure between RSS and Atom formats.
 */
type NormalizedItem = {
  feed: Omit<ReturnType<typeof parseRssFeed | typeof parseAtomFeed>, 'entries' | 'items'>;
  outline: Outline;
  item: NonNullable<
    ReturnType<typeof parseRssFeed>['items']
  >[number];
  originalItem?: NonNullable<
    ReturnType<typeof parseAtomFeed>['entries'] | ReturnType<typeof parseRssFeed>['items']
  >[number];
};

/**
 * Normalizes feed items to a common structure.
 * Converts Atom items to match RSS item structure for consistent processing.
 * @param item - Feed item to normalize
 * @returns Normalized feed item
 * @example
 * ```typescript
 * const items = getItems(feeds);
 * const normalizedItems = items.map(getNormalizedItem);
 * ```
 * @see {@link Item} for the input type
 * @see {@link NormalizedItem} for the output type
 */
function getNormalizedItem(item: Item,): NormalizedItem {
  l.debug`getNormalizedItem`;
  if (item.outline.type === 'atom') {
    const myItem = item as {
      feed: Omit<ReturnType<typeof parseRssFeed | typeof parseAtomFeed>,
        'entries' | 'items'>;
      outline: Outline;
      item: NonNullable<ReturnType<typeof parseAtomFeed>['entries']>[number];
    };
    const categories = myItem.item.categories;
    const links = myItem.item.links;
    const title = myItem.item.title;
    const published = myItem.item.published;
    const updated = myItem.item.updated;
    const content = myItem.item.content;
    const id = myItem.item.id;

    const link = links?.at(0,);
    const description = content;
    const pubDate = updated ?? published;
    const guid = id;

    const newItem = new Map<string, string | Link | Category[]>();
    if (title)
      newItem.set('title', title,);

    if (link)
      newItem.set('link', link,);

    if (description)
      newItem.set('description', description,);

    if (categories)
      newItem.set('categories', categories,);

    if (pubDate)
      newItem.set('pubDate', pubDate,);
    if (guid)
      newItem.set('guid', guid,);

    const result = { ...item, item: Object.fromEntries(newItem,), originalItem: item
      .item, };
    l.debug`getNormalizedItem ${result}`;
    return result;
  }

  l.debug`getNormalizedItem ${item}`;
  return item as NormalizedItem;
}

/**
 * Type definition for feed items with extracted publication dates.
 * Extends normalized items with a dedicated date property.
 */
export type ItemWDate = NormalizedItem & { pubDateDate: Date; };

/**
 * Extracts and parses the publication date from a normalized item.
 * @param item - Normalized feed item
 * @returns Feed item with extracted publication date
 * @example
 * ```typescript
 * const normalizedItems = items.map(getNormalizedItem);
 * const itemsWDate = normalizedItems.map(getItemWDate);
 * ```
 * @see {@link NormalizedItem} for the input type
 * @see {@link ItemWDate} for the output type
 * @see {@link z.coerce.date} for date parsing
 */
function getItemWDate(item: NormalizedItem,): ItemWDate {
  l.debug`getItemWDate`;
  const pubDateDate = z.coerce.date().parse(item.item.pubDate ?? new Date(0,),);
  const result = { ...item, pubDateDate, };
  l.debug`getItemWDate ${result}`;
  return result;
}

/**
 * Sorts feed items by their publication dates in descending order (newest first).
 * @param itemsWDate - Array of feed items with publication dates
 * @returns Array of items sorted by publication date
 * @example
 * ```typescript
 * const itemsWDate = normalizedItems.map(getItemWDate);
 * const sortedItems = getSortedItems(itemsWDate);
 * ```
 * @see {@link ItemWDate} for the input type
 * @see {@link Array.toSorted} for sorting implementation
 */
function getSortedItems(itemsWDate: ItemWDate[],): ItemWDate[] {
  l.debug`getSortedItems`;
  const result = itemsWDate.toSorted(function byDate(a, b,) {
    const aDate = a.pubDateDate;
    const bDate = b.pubDateDate;
    return bDate.getTime() - aDate.getTime();
  },);
  l.debug`getSortedItems ${result[0]} * ${result.length}`;
  return result;
}

/**
 * Current collection of sorted feed items.
 * Updated automatically when feeds change.
 */
const sortedItems: ItemWDate[] = [];

export const sortedItemsObservable: {
  value: ItemWDate[];
} = await createObservableAsync(sortedItems, onItemsChange,);

export function onSortedFeedsChange(
  feeds: FeedWOutline[],
): void {
  l.debug`onSortedFeedsChange`;

  sortedItemsObservable.value = getNewSortedItems(feeds,);

  l.debug`onSortedFeedsChange sortedItems ${
    sortedItemsObservable.value.at(-1,)
  } * ${sortedItemsObservable.value.length}`;
}

function getNewSortedItems(
  feeds: FeedWOutline[],
): ItemWDate[] {
  l.debug`getNewSortedItems`;
  const items = getItems(feeds,);
  const normalizedItems = items.map(item => getNormalizedItem(item,));
  const itemsWDate = normalizedItems.map(normalizedItem => getItemWDate(normalizedItem,));
  const result = getSortedItems(itemsWDate,);
  l.debug`getNewSortedItems ${result.at(-1,)} * ${result.length}`;
  return result;
}
