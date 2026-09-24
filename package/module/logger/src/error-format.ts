/**
 Internal logger error reporting helpers.
 
 Logger internals cannot report failures through the logger itself without
 risking recursion, so these helpers format caught values and write directly
 to the host console.
 
 @module
 */

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

/**
 Reports a logger-internal caught value without going back through logger
 sinks, formatting it via {@link caughtValueText}.
 
 @param context - Human-readable operation that caught the value.
 
 @param error - Caught value to include in the diagnostic.
 
 @mutates error - `caughtValueText` may invoke string-conversion hooks.
 
 @example
 ```ts
 reportLoggerInternalError({
   context: 'console sink verify failed',
   error: new Error('blocked'),
 });
 ```
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
  if ((typeof console) === 'undefined')
    return;

  // Internal failures cannot go through a sink; use whatever host console
  // method is available without assuming a browser-style `console.warn`.
  /**
   Available console method for reporting the internal failure.
   */
  const report = (typeof console.warn) === 'function'
    ? console.warn
    : ((typeof console.error) === 'function' ? console.error : console.log);
  if ((typeof report) !== 'function')
    return;

  report.call(
    console,
    `logger internal error: ${context}: ${caughtValueText(error,)}`,
  );
}
