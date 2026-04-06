// 105 lines: fetch, parse, and sort are a single pipeline; splitting obscures the data flow
import { $ as mapIterableAsync, } from '@monochromatic-dev/module-es/map-iterable-async';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import {
  type Atom,
  type Opml,
  parseAtomFeed,
  parseRssFeed,
  type Rss,
} from 'feedsmith';
import * as z from 'zod/mini';
import { l as parentLogger, } from './log.ts';
import type { InnerOutlineWUrl, } from './outline.ts';

/** Tagged logger for the feed module. */
const l = tagged({
  tag: 'feed',
  l: parentLogger,
},);

/**
 * Parsed feed data paired with its OPML outline metadata.
 * Combines the feed content with source information for display.
 */
export type FeedWOutline = {
  feed: Rss.Feed<string> | Atom.Feed<string>;
  outline: Opml.Outline<string>;
};

//region Feed fetching and sorting -- Retrieves feeds from URLs, parses them, and sorts by date

/**
 * Fetches, parses, and date-sorts feeds from OPML outlines.
 * Handles both RSS and Atom formats, discarding feeds that fail to fetch or parse.
 *
 * @param outlines - Outlines with validated xmlUrl properties
 *
 * @returns Feeds sorted by publication date (newest first)
 *
 * @example
 * ```ts
 * const feeds = await getSortedFeeds(outlines);
 * ```
 */
export async function getSortedFeeds(
  outlines: InnerOutlineWUrl[],
): Promise<FeedWOutline[]> {
  const innerL = tagged({
    tag: getSortedFeeds.name,
    l,
  },);
  const feeds = await fetchAndParseFeeds(outlines,);
  const result = feeds.toSorted(function byDate(
    feedA,
    feedB,
  ) {
    return extractDate(feedB,).getTime() - extractDate(feedA,).getTime();
  },);
  innerL.debug(`sorted ${String(result.length,)} feeds`,);
  return result;
}

/**
 * Fetches and parses feeds from outlines, discarding failures.
 *
 * @param outlines - Outlines with xmlUrl properties
 *
 * @returns Successfully fetched and parsed feeds
 */
async function fetchAndParseFeeds(
  outlines: InnerOutlineWUrl[],
): Promise<FeedWOutline[]> {
  const innerL = tagged({
    tag: fetchAndParseFeeds.name,
    l,
  },);
  const DISCARD = Symbol('discard',);
  /** Fetched OPML text paired with its source outline for later parsing. */
  type TextWOutline = {
    text: string;
    outline: Opml.Outline<string> & { xmlUrl: string; };
  };
  const textsWOutline: TextWOutline[] = (await mapIterableAsync(
    async function fetchFeed(outline: Opml.Outline<string> & { xmlUrl: string; },) {
      const response = await fetch(outline.xmlUrl,);
      if (!response.ok) {
        innerL.warn(`${outline.xmlUrl} responded ${String(response.status,)}`,);
        return DISCARD;
      }
      try {
        return {
          text: await response.text(),
          outline,
        };
      }
      catch (error) {
        innerL.warn(
          `text conversion failed for ${outline.xmlUrl}: ${JSON.stringify(error,)}`,
        );
        return DISCARD;
      }
    },
    outlines,
  ))
    .filter(function notDiscard(value,): value is TextWOutline {
      return value !== DISCARD;
    },);
  innerL.debug(`fetched ${String(textsWOutline.length,)} feed texts`,);
  return textsWOutline.flatMap(function parse({
    text,
    outline,
  },) {
    const parser = outline.type === 'atom' ? parseAtomFeed : parseRssFeed;
    try {
      return [{
        feed: parser(text,),
        outline,
      },];
    }
    catch (error) {
      innerL.warn(`parse failed for ${outline.xmlUrl}: ${JSON.stringify(error,)}`,);
      return [];
    }
  },);
}

/**
 * Extracts the publication date from a feed, falling back to epoch.
 *
 * @param feedWOutline - Feed with outline metadata
 *
 * @returns Parsed publication date
 */
function extractDate(feedWOutline: FeedWOutline,): Date {
  const {
    feed,
    outline,
  } = feedWOutline;
  if (outline.type === 'atom') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- outline.type discriminant narrows the feed type
    const atomFeed = feed as Atom.Feed<string>;
    return z.coerce.date().parse(atomFeed.updated ?? new Date(0,),);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- non-atom feeds are RSS
  const rssFeed = feed as Rss.Feed<string>;
  return z.coerce.date().parse(rssFeed.pubDate ?? new Date(0,),);
}

//endregion Feed fetching and sorting
