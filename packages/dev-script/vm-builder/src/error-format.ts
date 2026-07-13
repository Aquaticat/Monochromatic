/**
 * Caught-error formatting helpers for vm-builder user-facing logs.
 *
 * @example
 * ```ts
 * caughtErrorMessage(new Error('missing'));
 * // 'missing'
 * ```
 */

/**
 * Formats unknown caught value for a concise log message.
 *
 * @param error - Unknown caught value.
 *
 * @returns Error message, primitive string, or noncoercing value category.
 *
 * @example
 * ```ts
 * caughtErrorMessage(new Error('missing'));
 * // 'missing'
 * ```
 */
export function caughtErrorMessage(error: unknown,): string {
  if (Error.isError(error,))
    return error.message;
  if ((typeof error) === 'string')
    return error;

  return `non-Error ${typeof error}`;
}
