/**
 * Root tagged logger for the inference canary.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * import { l, tagged } from './log.ts';
 *
 * function runProbe(probe: Probe): void {
 *   const rl = tagged({ tag: runProbe.name, l });
 *   rl.info('starting probe execution');
 * }
 * ```
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
 * Root tagged logger for all inference canary subsystems.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('starting operation');
 * ```
 */
export const l: Logger = tagged({
  tag: 'canary',
  l: $,
},);

export type { Logger, };
export { tagged, };
