import {
  $,
  initPromise,
} from '@monochromatic-dev/module-es/logger';
import type { $ as Logger, } from '@monochromatic-dev/module-es/ts/types/t object/t logger/t/index.ts';

await initPromise;

/**
 * Shared logger instance for all RSS subsystems.
 * Uses the module-es multi-sink logger.
 * @public
 */
export const l: Logger = $;
