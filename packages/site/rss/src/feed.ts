import {
  binary,
  createObservableAsync,
  deConcurrency,
  filterIterableAsync,
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
  mapIterableAsync,
  notNullishOrThrow,
  throws,
  unary,
} from '@monochromatic-dev/module-es';
import {
  parseAtomFeed,
  parseRssFeed,
} from 'feedsmith';
import type { Outline, } from 'node_modules/feedsmith/dist/opml/parse/types';
import { z, } from 'zod/v4-mini';
import { onSortedFeedsChange, } from './item.ts';
import type { InnerOutlineWUrl, } from './outline.ts';

await logtapeConfigure(await logtapeConfiguration(),);

const l = logtapeGetLogger(['a', 'm',],);

/**
 * Type definition for feed data combined with its corresponding outline.
 * Combines parsed feed data with metadata from the OPML structure.
 */
export type FeedWOutline = {
  feed: ReturnType<typeof parseRssFeed | typeof parseAtomFeed>;
  outline: Outline;
};

/**
 * Fetches and parses RSS/Atom feeds from the configured URLs.
 * Handles both RSS and Atom feed formats with appropriate error handling.
 * @param innerOutlinesWUrl - Array of outlines with valid XML URLs
 * @returns Promise resolving to an array of feed objects with outlines
 * @throws {@link Error} If any feed cannot be fetched or parsed
 * @example
 * ```typescript
 * const feeds = await getFeeds(innerOutlinesWUrl);
 * ```
 * @see {@link fetch} for HTTP requests
 * @see {@link parseRssFeed} for RSS parsing
 * @see {@link parseAtomFeed} for Atom parsing
 */
async function getFeeds(
  innerOutlinesWUrl: InnerOutlineWUrl[],
): Promise<FeedWOutline[]> {
  l.debug`getFeeds`;
  const DISCARD = Symbol('discard',);

  const innerOutlineWUrlTexts: { text: string;
    outline: Outline & { xmlUrl: string; }; }[] = (await mapIterableAsync(
      async function withText(innerOutlineWUrl: Outline & { xmlUrl: string; },) {
        const response = await fetch(innerOutlineWUrl.xmlUrl,);
        if (!response.ok) {
          l.warn`${response} not ok for ${innerOutlineWUrl}`;
          return DISCARD;
        }
        try {
          return { text: await response.text(), outline: innerOutlineWUrl, };
        }
        catch (error) {
          l.warn`${error} when converting ${response} to text for ${innerOutlineWUrl}`;
          return DISCARD;
        }
      },
      innerOutlinesWUrl,
    ))
      .filter(function notDiscard(value,) {
        return value !== DISCARD;
      },);

  l.debug`innerOutlineWUrlTexts ${innerOutlineWUrlTexts[0]?.outline} ${
    innerOutlineWUrlTexts[0]?.text.slice(0, 100,)
  } * ${innerOutlineWUrlTexts.length}`;

  const result = innerOutlineWUrlTexts
    .map(function textToFeed(innerOutlineWUrlText,) {
      if (innerOutlineWUrlText.outline.type === 'atom') {
        try {
          return { feed: parseAtomFeed(innerOutlineWUrlText.text,),
            outline: innerOutlineWUrlText.outline, };
        }
        catch (error) {
          l.warn`${error} parseAtomFeed for ${innerOutlineWUrlText}`;
          return DISCARD;
        }
      }
      try {
        return { feed: parseRssFeed(innerOutlineWUrlText.text,),
          outline: innerOutlineWUrlText.outline, };
      }
      catch (error) {
        l.warn`${error} parseRssFeed for ${innerOutlineWUrlText}`;
        return DISCARD;
      }
    },)
    .filter(function notDiscard(value,) {
      return value !== DISCARD;
    },);

  l.debug`getFeeds ${result[0]} * ${result.length}`;

  return result;
}

/**
 * Extracts the publication date from a feed.
 * Handles both RSS and Atom feed formats with appropriate date parsing.
 * @param feed - Feed object with outline metadata
 * @returns The publication date of the feed
 * @example
 * ```typescript
 * const feeds = await getFeeds(innerOutlinesWUrl);
 * const date = getFeedDate(feeds[0]);
 * ```
 * @see {@link z.coerce.date} for date parsing
 * @see {@link FeedWOutline} for the input type
 */
function getFeedDate(feed: FeedWOutline,): Date {
  l.debug`getFeedDate`;
  if (feed.outline.type === 'atom') {
    const myFeed = feed.feed as ReturnType<typeof parseAtomFeed>;
    return z.coerce.date().parse(myFeed.updated ?? new Date(0,),);
  }
  const myFeed = feed.feed as ReturnType<typeof parseRssFeed>;
  return z.coerce.date().parse(myFeed.pubDate ?? new Date(0,),);
}

/**
 * Sorts feeds by their publication dates in descending order (newest first).
 * @param feeds - Array of feed objects with outlines
 * @returns Array of feeds sorted by publication date
 * @example
 * ```typescript
 * const feeds = await getFeeds(innerOutlinesWUrl);
 * const sortedFeeds = getSortedFeeds(feeds);
 * ```
 * @see {@link getFeedDate} for date extraction
 * @see {@link Array.toSorted} for sorting implementation
 */
function getSortedFeeds(feeds: FeedWOutline[],): FeedWOutline[] {
  l.debug`getSortedFeeds`;
  const result = feeds.toSorted(function(a, b,) {
    return getFeedDate(b,).getTime() - getFeedDate(a,).getTime();
  },);
  l.debug`getSortedFeeds ${result[0]} ${result.at(-1,)} * ${result.length}`;
  return result;
}

const sortedFeeds: FeedWOutline[] = [];

const sortedFeedsObservable = await createObservableAsync(sortedFeeds,
  onSortedFeedsChange,);

export async function onInnerOutlinesWUrlChange(
  innerOutlinesWUrl: InnerOutlineWUrl[],
): Promise<void> {
  l.debug`onInnerOutlinesWUrlChange`;

  sortedFeedsObservable.value = await getNewSortedFeeds(innerOutlinesWUrl,);

  l.debug`onInnerOutlinesWUrlChange sortedFeeds ${
    sortedFeedsObservable.value.at(-1,)
  } * ${sortedFeedsObservable.value.length}`;
}

async function getNewSortedFeeds(
  innerOutlinesWUrl: InnerOutlineWUrl[],
): Promise<FeedWOutline[]> {
  l.debug`getNewSortedFeeds`;
  const result = getSortedFeeds(await getFeeds(innerOutlinesWUrl,),);
  l.debug`getNewSortedFeeds ${result.at(-1,)} * ${result.length}`;
  return result;
}
