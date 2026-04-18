import {
  initPromise,
  logger,
} from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import type { Logger, } from '@monochromatic-dev/module-logger/types';

await initPromise;

/**
 * Root tagged logger for all RSS subsystems.
 * Tagged with `rss` so every log line carries the subsystem prefix.
 * Sub-modules should compose deeper tags via `tagged(\{ tag, l \})`.
 *
 * @see `tagged` for composing nested tags
 */
export const l: Logger = tagged({
  tag: 'rss',
  l: logger,
},);
