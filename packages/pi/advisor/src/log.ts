/**
 * Root tagged logger for the Advisor package.
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

/** Root logger tagged with package identity. */
export const l: Logger = tagged({
  tag: 'pi-advisor',
  l: logger,
},);
