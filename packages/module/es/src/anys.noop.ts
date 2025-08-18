/**
 * No-operation function that does nothing when called.
 * Useful for creating loggers that perform no action with minimal performance overhead.
 * @param _parameters - Any parameters passed to the function (not used)
 * @example
 * ```ts
 * // Create a logger that does nothing with zero performance penalty
 * const noopLogger: Logger = {
 *   trace: noop,
 *   debug: noop,
 *   info: noop,
 *   warn: noop,
 *   error: noop,
 *   fatal: noop,
 * };
 * ```
 */
export function noop(..._parameters: unknown[]): void {
  // intentionally empty;
}
