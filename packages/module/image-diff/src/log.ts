import {
  $,
  initPromise,
} from '@monochromatic-dev/module-es/logger';
import { $ as tagged } from '@monochromatic-dev/module-es/tagged';
import type { $ as Logger } from '@monochromatic-dev/module-es/ts/types/t object/t logger/t/index.ts';

await initPromise;

/**
 * Root tagged logger for the image-diff library.
 * Sub-modules compose deeper tags via `tagged({ tag, l })`.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: myFn.name, l });
 * rl.info('comparing images');
 * ```
 */
export const l: Logger = tagged({ tag: 'image-diff', l: $, });

export type { Logger };
export { tagged };
