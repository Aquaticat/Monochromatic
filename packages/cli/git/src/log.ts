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
  l: $,
},);

export type { Logger, };
export { tagged, };
