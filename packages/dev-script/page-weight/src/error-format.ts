/**
 * Caught-error formatting helpers for page-weight diagnostics.
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
 * @returns Error message when available, otherwise stringified value.
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

  return String(error,);
}
