/**
 * Tagged logger roots for auto-mode extension.
 *
 * @module
 */

import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

/**
 * Package logger root shared by auto-mode modules.
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for extension entry-point lifecycle.
 */
const indexLogger = tagged({
  tag: 'index',
  l: parentLogger,
},);

/**
 * Create function-boundary logger below auto-mode entry point.
 *
 * @param tag - Function name used as structured logger tag.
 *
 * @returns Logger tagged below package and entry-point roots.
 *
 * @example
 * ```typescript
 * const l = entryPointLogger('initialize');
 * ```
 */
function entryPointLogger(tag: string,): Logger {
  return tagged({
    tag,
    l: indexLogger,
  },);
}

export { entryPointLogger, };
