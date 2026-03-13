import {
  $,
  initPromise,
} from '@monochromatic-dev/module-es/logger';
import { $ as tagged } from '@monochromatic-dev/module-es/tagged';
import type { $ as Logger } from '@monochromatic-dev/module-es/ts/types/t object/t logger/t/index.ts';

await initPromise;

/**
 * Root tagged logger for xdg-terminal-exec subsystems.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('starting resolution');
 * ```
 */
export const l: Logger = tagged({ tag: 'xdg-terminal-exec', l: $ });

export type { Logger };
export { tagged };
