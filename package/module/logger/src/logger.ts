import { defaultSinks, } from '#default-sinks';

import { createLogger, } from './create-logger.ts';

import type { Logger, } from './types.ts';

/**
 Default multi-sink logger plus its eager readiness promise, built by
 applying {@link createLogger} to the platform-selected `defaultSinks`
 (`default-sinks.node.ts` under the `node` condition,
 `default-sinks.neutral.ts` otherwise; see the `imports` map in
 `package.json`).
 */
const {
  initPromise: defaultInitPromise,
  logger: defaultLogger,
} = createLogger({ sinks: defaultSinks, },);

/**
 Eager readiness promise. Consumers do not need to await this before logging;
 {@link Logger.flush} awaits it internally, and startup records replay to
 async sinks as they become available.
 */
export const initPromise: Promise<void> = defaultInitPromise;

/**
 Multi-sink logger that writes to all available backends.
 Startup records replay to async sinks that verify after the log call.
 Log calls throw only when initialization proves no backend is available,
 which the console sink prevents in every supported runtime.
 
 @example
 ```ts
 import { logger, } from '\@monochromatic-dev/module-logger/logger';
 
 logger.error('unexpected shutdown',);
 await logger.flush();
 ```
 */
export const logger: Logger = defaultLogger;
