// Fixture: fully documented functions with params and returns.
// Expected: zero tsdoc rule violations.

/**
 * Greets a user by name.
 *
 * @param name - user's display name
 *
 * @param count - number of times to repeat
 *
 * @returns formatted greeting string
 *
 * @example
 * ```ts
 * greet('Alice', 2);
 * ```
 */
function greet(name: string, count: number): string {
  return `Hello ${name}!`.repeat(count);
}

/**
 * Logs a message without returning.
 *
 * @param message - text to log
 */
function log(message: string): void {
  console.error(message);
}

/**
 * Internal helper.
 *
 * @internal
 */
function internalHelper(): void { /* Intentional no-op for TSDoc testing */ }

/**
 * Escaped content with *\/ inside.
 */
function withEscapedClose(): void { /* Intentional no-op for TSDoc testing */ }

/**
 * Method with rest parameter.
 *
 * @param parts - path segments to join
 *
 * @returns joined path
 */
function join(...parts: string[]): string {
  return parts.join('/');
}

/** Options for the process function. */
type ProcessOptions = {
  /** Item to process. */
  value: string;
  /** Number of repetitions. */
  count: number;
};

/**
 * Processes a value multiple times using destructured parameters.
 *
 * @param value - item to process
 *
 * @param count - number of repetitions
 *
 * @returns processed result
 */
function processDestructured({ value, count }: ProcessOptions): string {
  return value.repeat(count);
}

/**
 * Mixes named and destructured parameters.
 *
 * @param prefix - prefix to prepend
 *
 * @param value - item to process
 *
 * @param count - number of repetitions
 *
 * @returns processed result with prefix
 */
function mixedParams(prefix: string, { value, count }: ProcessOptions): string {
  return prefix + value.repeat(count);
}

export {
  greet,
  log,
  internalHelper,
  withEscapedClose,
  join,
  processDestructured,
  mixedParams,
};
