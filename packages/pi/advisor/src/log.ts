/**
 * Root tagged logger for the Advisor package.
 *
 * @module
 */

import {
  initPromise,
  logger,
} from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import type { Logger, } from '@monochromatic-dev/module-logger/types';

await initPromise;

/** Root logger tagged with package identity. */
export const l: Logger = tagged({
  tag: 'pi-advisor',
  l: logger,
},);
