import type {
  Opml,
  parseAtomFeed,
  parseRssFeed,
} from 'feedsmith';

/**
 * Individual feed item with its parent feed metadata and OPML outline.
 */
export type Item = {
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
export type NormalizedItem = {
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
export type AtomItem = {
  feed: Omit<ReturnType<typeof parseAtomFeed>, 'entries'>;
  outline: Opml.Outline<string>;
  item: NonNullable<ReturnType<typeof parseAtomFeed>['entries']>[number];
};

/** Normalized item with an extracted publication date for sorting. */
export type ItemWDate = NormalizedItem & { pubDateDate: Date; };
