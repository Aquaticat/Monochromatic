import {
  initPromise,
  logger,
} from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import type { Logger, } from '@monochromatic-dev/module-logger/types';

await initPromise;

/**
 * Root tagged logger for all cli-git subsystems.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * import { l, tagged } from './log.ts';
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('resolved git binary');
 * ```
 */
export const l: Logger = tagged({
  tag: 'cli-git',
  l: logger,
},);

export type { Logger, };
export { tagged, };
