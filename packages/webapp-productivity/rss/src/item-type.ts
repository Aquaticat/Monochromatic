import type {
  Atom,
  Opml,
  Rss,
} from 'feedsmith';

/**
 * Individual feed item with its parent feed metadata and OPML outline.
 */
export type Item = {
  feed: Omit<Rss.Feed<string> | Atom.Feed<string>, 'entries' | 'items'>;
  outline: Opml.Outline<string>;
  item: Rss.Item<string> | Atom.Entry<string>;
};

/**
 * Feed item normalized to RSS-like structure for uniform rendering.
 * Atom entries are converted to match RSS item shape.
 */
export type NormalizedItem = {
  feed: Omit<Rss.Feed<string>, 'items'>;
  originalFeed?: Omit<Rss.Feed<string> | Atom.Feed<string>, 'entries' | 'items'>;
  outline: Opml.Outline<string>;
  item: Rss.Item<string>;
  originalItem?: Rss.Item<string> | Atom.Entry<string>;
};

/**
 * Atom feed item narrowed to its specific types for normalization.
 */
export type AtomItem = {
  feed: Omit<Atom.Feed<string>, 'entries'>;
  outline: Opml.Outline<string>;
  item: Atom.Entry<string>;
};

/** Normalized item with an extracted publication date for sorting. */
export type ItemWDate = NormalizedItem & { pubDateDate: Date; };
