/**
 * Root logger for rgffplay.
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

/**
 * Root tagged logger for rgffplay.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('finding music files');
 * ```
 */
export const l: Logger = tagged({
  tag: 'rgffplay',
  l: logger,
},);

export type { Logger, };
export { tagged, };
