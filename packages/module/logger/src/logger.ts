import { createLogger, } from './create-logger.ts';
import { consoleSink, } from './sinks/console.ts';
import { fileSink, } from './sinks/file.ts';
import { opfsSink, } from './sinks/opfs.ts';
import { sessionStorageSink, } from './sinks/session-storage.ts';
import type {
  Logger,
  Sink,
} from './types.ts';

/**
 * Default sink backends to attempt, in priority order. Each runtime keeps
 * only the sinks whose `verify` confirms its backend: console everywhere,
 * OPFS and sessionStorage in browsers, the file sink under Node. The noop
 * sink is intentionally absent so a process with no working backend surfaces
 * the "No logging backends available" error instead of silently discarding.
 */
const defaultSinks: readonly Sink[] = [
  consoleSink,
  opfsSink,
  sessionStorageSink,
  fileSink,
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
 * `flush()` awaits it internally, and startup records replay to async sinks as
 * they become available.
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
