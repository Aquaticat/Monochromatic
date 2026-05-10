/**
 * Root tagged logger for the auto-mode package.
 *
 * Tagged with `auto-mode` so every log line carries the package
 * prefix. Sub-modules should compose deeper tags via
 * `tagged({ tag, l })`, typically passing `myFn.name` as the tag
 * so refactors keep prefixes in sync.
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
 * Root tagged logger; sub-modules compose deeper tags via {@link tagged}.
 */
export const l: Logger = tagged({
  tag: 'auto-mode',
  l: logger,
},);
