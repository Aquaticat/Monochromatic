/**
 * Caught-error formatting helpers for deps-cube diagnostics.
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
 * @returns Error message, thrown string, or non-Error runtime category.
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

  return `Non-Error thrown value of type ${typeof error}`;
}
