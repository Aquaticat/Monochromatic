import { createLogger, } from './create-logger.ts';
import { createConsoleSink, } from './sink/console.ts';
import { createFileSink, } from './sink/file.ts';
import { createIndexedDbSink, } from './sink/indexed-db.ts';
import { createLocalStorageSink, } from './sink/local-storage.ts';
import { createSessionStorageSink, } from './sink/session-storage.ts';
import type {
  Logger,
  Sink,
} from './types.ts';

/**
 * Default sink backends to attempt, in priority order. Each runtime keeps
 * only the sinks whose `verify` confirms its backend: {@link createConsoleSink}
 * everywhere, {@link createIndexedDbSink} in browsers,
 * {@link createSessionStorageSink} wherever web storage round-trips (browsers,
 * Node 22+, Deno), {@link createLocalStorageSink} wherever `localStorage`
 * round-trips (browsers, Deno, Node launched with `--localstorage-file`),
 * {@link createFileSink} under Node. The noop sink is intentionally absent so
 * a process with no working backend surfaces the "No logging backends
 * available" error instead of silently discarding. The OPFS sink is exported
 * but no longer a default: its stream stages writes until a close that a
 * crash never performs, so IndexedDB holds the persistent-browser slot; see
 * `DECISIONS.md`.
 */
const defaultSinks: readonly Sink[] = [
  createConsoleSink(),
  createIndexedDbSink(),
  createSessionStorageSink(),
  createLocalStorageSink(),
  createFileSink(),
];

/**
 * Default multi-sink logger plus its eager readiness promise, built by
 * applying {@link createLogger} to {@link defaultSinks}.
 */
const {
  initPromise: defaultInitPromise,
  logger: defaultLogger,
} = createLogger({ sinks: defaultSinks, },);

/**
 * Eager readiness promise. Consumers do not need to await this before logging;
 * {@link Logger.flush} awaits it internally, and startup records replay to
 * async sinks as they become available.
 */
export const initPromise: Promise<void> = defaultInitPromise;

/**
 * Multi-sink logger that writes to all available backends.
 * Startup records replay to async sinks that verify after the log call;
 * log calls throw only after initialization proves no backend is available.
 *
 * @example
 * ```ts
 * import { logger, } from '\@monochromatic-dev/module-logger/logger';
 *
 * logger.error('unexpected shutdown',);
 * await logger.flush();
 * ```
 */
export const logger: Logger = defaultLogger;
