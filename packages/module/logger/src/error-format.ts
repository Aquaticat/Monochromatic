/**
 * Internal logger error reporting helpers.
 *
 * Logger internals cannot report failures through the logger itself without
 * risking recursion, so these helpers format caught values and write directly
 * to the host console.
 *
 * @module
 */

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

/**
 * Reports a logger-internal caught value without going back through logger
 * sinks, formatting it via {@link caughtValueText}.
 *
 * @param context - Human-readable operation that caught the value.
 *
 * @param error - Caught value to include in the diagnostic.
 *
 * @mutates error - `caughtValueText` may invoke string-conversion hooks.
 *
 * @example
 * ```ts
 * reportLoggerInternalError({
 *   context: 'console sink verify failed',
 *   error: new Error('blocked'),
 * });
 * ```
 */
export function reportLoggerInternalError(
  {
    context,
    error,
  }: {
    readonly context: string;
    readonly error: unknown;
  },
): void {
  console.warn(
    `logger internal error: ${context}: ${caughtValueText(error,)}`,
  );
}
