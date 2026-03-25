/**
 * Root tagged logger for the editord client.
 *
 * All client modules compose deeper tags via `tagged({ tag, l })`.
 */

import {
  $,
  initPromise,
} from '@monochromatic-dev/module-es/logger';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import type {
  $ as Logger,
} from '@monochromatic-dev/module-es/ts/types/t object/t logger/t/index.ts';

await initPromise;

/**
 * Root tagged logger for all editord client subsystems.
 * Sub-modules should compose deeper tags via `tagged({ tag, l })`.
 */
export const l: Logger = tagged({
  tag: 'editord',
  l: $,
},);

export type { Logger, };
export { tagged, };
