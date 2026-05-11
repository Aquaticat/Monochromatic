/**
 * Public library entry for `@monochromatic-dev/dev-script-watch-restart`.
 * Re-exports the implementations that consumers compose into a watcher.
 *
 * Further exports (startWatchRestart, filter helpers, types) land as
 * each underlying module is implemented; the package is staged so each
 * commit ships a working build + tests for that module.
 */
export {
  DEFAULT_MAX_HASH_SIZE_BYTES,
  HashCache,
  type HashCacheOptions,
} from './hash-cache.ts';
