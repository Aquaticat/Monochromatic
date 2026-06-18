/**
 * Root tagged logger for the Pi Linkup package.
 *
 * @module
 */

import {
  logger,
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

/**
 * Root logger tagged with package identity.
 *
 * Submodules wrap this logger with module and function tags.
 *
 * @example
 * ```ts
 * linkupLogger.info('extension loaded');
 * ```
 */
const linkupLogger: Logger = tagged({
  tag: 'pi-linkup',
  l: logger,
},);

export { linkupLogger, };
