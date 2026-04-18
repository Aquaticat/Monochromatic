import {
  initPromise,
  logger,
} from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import type { Logger, } from '@monochromatic-dev/module-logger/types';

await initPromise;

/**
 * Root tagged logger for all file-enforcer subsystems.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('starting operation');
 * ```
 */
export const l: Logger = tagged({
  tag: 'file-enforcer',
  l: logger,
},);

export type { Logger, };
export { tagged, };
