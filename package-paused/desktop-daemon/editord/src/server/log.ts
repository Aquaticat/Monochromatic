/**
 * Root tagged logger for the editord server.
 *
 * All server modules compose deeper tags via `tagged({ tag, l })`.
 */

import {
  initPromise,
  logger,
} from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import type { Logger as ModuleLogger, } from '@monochromatic-dev/module-logger/types';

await initPromise;

/**
 * Logger handle passed through editord server modules.
 */
export type Logger = Readonly<ModuleLogger>;

/**
 * Root tagged logger for all editord server subsystems.
 * Sub-modules should compose deeper tags via `tagged({ tag, l })`.
 */
export const l: Logger = tagged({
  tag: 'editord',
  l: logger,
},);

export { tagged, };
