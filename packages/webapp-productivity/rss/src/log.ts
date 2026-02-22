import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
  type LogtapeLogger,
} from '@monochromatic-dev/module-es';

await logtapeConfigure(await logtapeConfiguration('rss',),);

/**
 * Root logger for the RSS application.
 * Used for general-purpose logging not tied to a specific subsystem.
 * @public
 */
export const l: LogtapeLogger = logtapeGetLogger(['a', 'i',],);

/**
 * Asset pipeline logger.
 * Focuses on HTML/CSS/JS extraction, inlining, hashing, and watcher updates.
 * @public
 */
export const lAsset: LogtapeLogger = logtapeGetLogger(['a', 'asset',],);

/**
 * Feed lifecycle logger.
 * Covers network fetches and parsing of RSS/Atom feeds.
 * @public
 */
export const lFeed: LogtapeLogger = logtapeGetLogger(['a', 'feed',],);

/**
 * Server-side HTML rendering logger.
 * Tracks Preact rendering and index.html body updates.
 * @public
 */
export const lHtml: LogtapeLogger = logtapeGetLogger(['a', 'html',],);

/**
 * Item processing logger.
 * Deals with item extraction, normalization, dating, and sorting.
 * @public
 */
export const lItem: LogtapeLogger = logtapeGetLogger(['a', 'item',],);

/**
 * OPML configuration logger.
 * Observes OPMLS changes, validation, and cascading updates.
 * @public
 */
export const lOpmls: LogtapeLogger = logtapeGetLogger(['a', 'opmls',],);

/**
 * OPML outline processing logger.
 * Tracks outline parsing and transformation to feed-ready structures.
 * @public
 */
export const lOutline: LogtapeLogger = logtapeGetLogger(['a', 'outline',],);

/**
 * Ignore mechanism logger.
 * Monitors ignore JSONL watcher and related API interactions.
 * @public
 */
export const lIgnore: LogtapeLogger = logtapeGetLogger(['a', 'ignore',],);
