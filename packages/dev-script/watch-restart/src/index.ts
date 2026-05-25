/**
 * Public library entry for `@monochromatic-dev/dev-script-watch-restart`.
 * Re-exports the implementations that consumers compose into a watcher.
 *
 * Further exports (startWatchRestart, filter helpers) land as each
 * underlying module is implemented; the package is staged so each
 * commit ships a working build + tests for that module.
 */
export {
  Child,
  type ChildOptions,
  type ChildState,
  DEFAULT_STOP_TIMEOUT_MS,
  type ExitListener,
  type ExitResult,
  NO_CHILD,
  type SpawnedChildHandle,
  type SpawnFn,
} from './child.ts';
export {
  anyFilter,
  composeFilters,
} from './filters/compose.ts';
export { contentHashFilter, } from './filters/content-hash.ts';
export { extFilter, } from './filters/ext.ts';
export { globFilter, } from './filters/glob.ts';
export { typeFilter, } from './filters/type.ts';
export {
  DEFAULT_MAX_HASH_SIZE_BYTES,
  HashCache,
  type HashCacheOptions,
} from './hash-cache.ts';
export {
  DEFAULT_DEBOUNCE_MS,
  startWatchRestart,
  type StartWatchRestartOptions,
  type WatchRestartHandle,
} from './start.ts';
export type {
  WatchCtx,
  WatchEntityType,
  WatchEvent,
  WatchEventKind,
  WatchFilter,
} from './types.ts';
export { Watcher, } from './watcher.ts';
export type {
  AwaitWriteFinishOptions,
  IgnoredPredicate,
  WatcherOptions,
} from './watcher-types.ts';
