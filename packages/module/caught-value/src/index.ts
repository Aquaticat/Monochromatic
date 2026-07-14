/**
 * Caught-value text preserving diagnostic information and exposing possible
 * caller-defined conversion effects.
 *
 * @example
 * ```ts
 * import { caughtValueText, } from '@monochromatic-dev/module-caught-value';
 *
 * caughtValueText(new Error('offline')); // 'offline'
 * caughtValueText({ toString: () => 'details' }); // 'details'
 * ```
 *
 * @packageDocumentation
 */

/**
 * Formats a caught value without discarding its diagnostic text.
 *
 * Error values contribute their message. Every other value follows JavaScript
 * string conversion so thrown objects can provide their own diagnostic text.
 *
 * @param value - Caught value to render.
 *
 * @returns Error message or string-coerced thrown value.
 *
 * @mutates value - Reading an Error message or string conversion may invoke getters, proxy traps, `Symbol.toPrimitive`, `toString`, or `valueOf`.
 *
 * @example
 * ```ts
 * caughtValueText(new Error('offline')); // 'offline'
 * caughtValueText(404); // '404'
 * ```
 */
export function caughtValueText(value: unknown,): string {
  if (Error.isError(value,))
    return value.message;
  return String(value,);
}
