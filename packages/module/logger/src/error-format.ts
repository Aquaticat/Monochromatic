/**
 * Internal logger error reporting helpers.
 *
 * Logger internals cannot report failures through the logger itself without
 * risking recursion, so these helpers format caught values and write directly
 * to the host console.
 *
 * @module
 */

/**
 * Formats an unknown caught value for an internal logger diagnostic.
 *
 * @param error - Caught value from a logger-internal `catch` block.
 *
 * @returns Error message, thrown string, or non-Error runtime category.
 *
 * @example
 * ```ts
 * caughtErrorMessage(new Error('disk full'));
 * // 'disk full'
 * ```
 */
export function caughtErrorMessage(error: unknown,): string {
  if (Error.isError(error,))
    return error.message;
  if ((typeof error) === 'string')
    return error;

  return `Non-Error thrown value of type ${typeof error}`;
}

/**
 * Reports a logger-internal caught value without going back through logger
 * sinks, formatting it via {@link caughtErrorMessage}.
 *
 * @param context - Human-readable operation that caught the value.
 *
 * @param error - Caught value to include in the diagnostic.
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
    `logger internal error: ${context}: ${caughtErrorMessage(error,)}`,
  );
}
