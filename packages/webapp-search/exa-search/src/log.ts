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
 * Root tagged logger for all exa-search subsystems.
 * Tagged with `exa-search` so every log line carries the subsystem prefix.
 * Sub-modules should compose deeper tags via `tagged({ tag, l })`.
 *
 * @see `tagged` for composing nested tags
 */
export const l: Logger = tagged({
  tag: 'exa-search',
  l: $,
},);
