/**
 * Root tagged logger for the pi-statusline package.
 *
 * @module
 */

import {
  initPromise,
  logger,
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

await initPromise;

/**
 * Root logger tagged with package identity.
 *
 * Submodules compose deeper tags with function names so refactors keep log
 * prefixes accurate.
 *
 * @example
 * ```ts
 * statuslineLogger.debug('loaded');
 * ```
 */
const statuslineLogger: Logger = tagged({
  tag: 'pi-statusline',
  l: logger,
},);

export { statuslineLogger, };
