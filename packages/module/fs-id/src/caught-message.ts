/**
 * Noncoercing caught-value diagnostics.
 *
 * @module
 */

/**
 * Formats unknown caught value without invoking caller-owned conversion hooks.
 *
 * @param error - Caught failure value.
 *
 * @returns Error message, primitive string, or value category.
 *
 * @example
 * ```ts
 * caughtMessage(new Error('failed')); // 'failed'
 * ```
 */
export function caughtMessage(error: unknown,): string {
  if (Error.isError(error,))
    return error.message;
  if ((typeof error) === 'string')
    return error;

  return `non-Error ${typeof error}`;
}
