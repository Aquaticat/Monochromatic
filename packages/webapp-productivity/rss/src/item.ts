// 154 lines: extraction, normalization, and sorting form one Item-\>ItemWDate pipeline; splitting loses type locality
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import type {
  Atom,
  Opml,
  parseAtomFeed,
  parseRssFeed,
} from 'feedsmith';
import { z, } from 'zod/v4-mini';
import type { FeedWOutline, } from './feed.ts';
import { l as parentLogger, } from './log.ts';

/** Tagged logger for the item module. */
const l = tagged({ tag: 'item', l: parentLogger, },);

//region Item type definitions

/**
 * Individual feed item with its parent feed metadata and OPML outline.
 */
type Item = {
  feed: Omit<ReturnType<typeof parseRssFeed | typeof parseAtomFeed>, 'entries' | 'items'>;
  outline: Opml.Outline<string>;
  item: NonNullable<
    ReturnType<typeof parseRssFeed>['items'] | ReturnType<typeof parseAtomFeed>['entries']
  >[number];
};

/**
 * Feed item normalized to RSS-like structure for uniform rendering.
 * Atom entries are converted to match RSS item shape.
 */
type NormalizedItem = {
  feed: Omit<ReturnType<typeof parseRssFeed>, 'items'>;
  originalFeed?: Omit<ReturnType<typeof parseRssFeed | typeof parseAtomFeed>,
    'entries' | 'items'>;
  outline: Opml.Outline<string>;
  item: NonNullable<ReturnType<typeof parseRssFeed>['items']>[number];
  originalItem?: NonNullable<
    ReturnType<typeof parseAtomFeed>['entries'] | ReturnType<typeof parseRssFeed>['items']
  >[number];
};

/**
 * Atom feed item narrowed to its specific types for normalization.
 */
type AtomItem = {
  feed: Omit<ReturnType<typeof parseAtomFeed>, 'entries'>;
  outline: Opml.Outline<string>;
  item: NonNullable<ReturnType<typeof parseAtomFeed>['entries']>[number];
};

/** Normalized item with an extracted publication date for sorting. */
export type ItemWDate = NormalizedItem & { pubDateDate: Date; };

//endregion Item type definitions

//region Item extraction and normalization -- Converts feed entries to a uniform dated format

/**
 * Extracts, normalizes, dates, and sorts all items from sorted feeds.
 *
 * @param feeds - Date-sorted feeds with outline metadata
 *
 * @returns Items sorted by publication date (newest first)
 *
 * @example
 * ```ts
 * const items = getSortedItems(await getSortedFeeds(outlines));
 * ```
 */
export function getSortedItems(feeds: FeedWOutline[],): ItemWDate[] {
  const innerL = tagged({ tag: getSortedItems.name, l, },);
  const items = extractItems(feeds,);
  const normalized = items.map(function normalize(feedItem,) {
    return getNormalizedItem(feedItem,);
  },);
  const dated = normalized.map(function addDate(item,) {
    return {
      ...item,
      pubDateDate: z.coerce.date().parse(item.item.pubDate ?? new Date(0,),),
    };
  },);
  const result = dated.toSorted(function byDate(itemA, itemB,) {
    return itemB.pubDateDate.getTime() - itemA.pubDateDate.getTime();
  },);
  innerL.debug(`${String(result.length)} sorted items`);
  return result;
}

/**
 * Extracts individual items from feeds, handling RSS items and Atom entries.
 *
 * @param feeds - Feeds with outline metadata
 *
 * @returns Flat array of items with parent feed metadata
 */
function extractItems(feeds: FeedWOutline[],): Item[] {
  const innerL = tagged({ tag: extractItems.name, l, },);
  const result: Item[] = feeds.flatMap(function extractFeedItems({ feed, outline, },) {
    if (outline.type === 'atom') {
      // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- outline.type discriminant narrows the feed type
      const atomFeed = feed as ReturnType<typeof parseAtomFeed>;
      const { entries, ...feedWithoutEntries } = atomFeed;
      if (entries === undefined || entries === null || entries.length === 0) {
        innerL.warn(`atom feed ${outline.text ?? 'unnamed'} has no entries`);
        return [];
      }
      return entries.map(function wrapEntry(entry,) {
        return { feed: feedWithoutEntries, outline, item: entry, };
      },);
    }
    // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- non-atom feeds are RSS
    const rssFeed = feed as ReturnType<typeof parseRssFeed>;
    const { items, ...feedWithoutItems } = rssFeed;
    if (items === undefined || items === null || items.length === 0) {
      innerL.warn(`rss feed ${outline.text ?? 'unnamed'} has no items`);
      return [];
    }
    return items.map(function wrapItem(rssItem,) {
      return { feed: feedWithoutItems, outline, item: rssItem, };
    },);
  },);
  innerL.debug(`extracted ${String(result.length)} items`);
  return result;
}

/**
 * Normalizes an item to RSS-like structure.
 * Atom entries are converted so downstream rendering handles one shape.
 *
 * @param item - Raw feed item (RSS or Atom)
 *
 * @returns Normalized item in RSS-compatible format
 */
function getNormalizedItem(item: Item,): NormalizedItem {
  // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- non-atom items already match NormalizedItem shape
  if (item.outline.type !== 'atom') return item as NormalizedItem;

  // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- outline.type === 'atom' narrows the item
  const atomItem = item as AtomItem;
  const { title, subtitle, } = atomItem.feed;
  const newFeed: Record<string, string> = {};
  if (title !== undefined && title !== null) newFeed.title = title;
  if (subtitle !== undefined && subtitle !== null) newFeed.subtitle = subtitle;

  const atomEntry = atomItem.item;
  const link = atomEntry.links?.at(0,);
  const newItem: Record<string, string | Atom.Link<string> | Atom.Category[]> = {};
  if (atomEntry.title !== undefined && atomEntry.title !== null) newItem.title = atomEntry.title;
  if (link !== undefined && link !== null) newItem.link = link;
  if (atomEntry.content !== undefined && atomEntry.content !== null) newItem.description = atomEntry.content;
  if (atomEntry.categories !== undefined && atomEntry.categories !== null) newItem.categories = atomEntry.categories;
  const pubDate = atomEntry.updated ?? atomEntry.published;
  if (pubDate !== undefined && pubDate !== null) newItem.pubDate = pubDate;
  if (atomEntry.id !== undefined && atomEntry.id !== null) newItem.guid = atomEntry.id;

  return {
    ...item,
    feed: newFeed,
    item: newItem,
    originalItem: item.item,
    originalFeed: item.feed,
  };
}

//endregion Item extraction and normalization
