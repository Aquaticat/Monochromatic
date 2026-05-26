import type {
  Atom,
  Opml,
  Rss,
} from 'feedsmith';
import type { DeepReadonly, } from './types.ts';

/**
 * Individual feed item with its parent feed metadata and OPML outline.
 * Deeply readonly because the pipeline only reads these parsed values.
 */
export type Item = DeepReadonly<{
  feed: Omit<Rss.Feed<string> | Atom.Feed<string>, 'entries' | 'items'>;
  outline: Opml.Outline<string>;
  item: Rss.Item<string> | Atom.Entry<string>;
}>;

/**
 * Feed item normalized to RSS-like structure for uniform rendering.
 * Atom entries are converted to match RSS item shape.
 * Deeply readonly because the renderers only read these values.
 */
export type NormalizedItem = DeepReadonly<{
  feed: Omit<Rss.Feed<string>, 'items'>;
  originalFeed?: Omit<Rss.Feed<string> | Atom.Feed<string>, 'entries' | 'items'>;
  outline: Opml.Outline<string>;
  item: Rss.Item<string>;
  originalItem?: Rss.Item<string> | Atom.Entry<string>;
}>;

/**
 * Atom feed item narrowed to its specific types for normalization.
 * Deeply readonly because normalization only reads these fields.
 */
export type AtomItem = DeepReadonly<{
  feed: Omit<Atom.Feed<string>, 'entries'>;
  outline: Opml.Outline<string>;
  item: Atom.Entry<string>;
}>;

/** Normalized item with an extracted publication date for sorting. */
export type ItemWDate = NormalizedItem & { readonly pubDateDate: Date; };
