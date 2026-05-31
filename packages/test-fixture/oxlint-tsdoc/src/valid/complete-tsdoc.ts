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
function greet(name: string, count: number,): string {
  return `Hello ${name}!`.repeat(count,);
}

/**
 * Logs a message without returning.
 *
 * @param message - text to log
 *
 * @example
 * ```ts
 * log('something happened');
 * ```
 */
function log(message: string,): void {
  console.error(message,);
}

/**
 * Internal helper.
 *
 * @internal
 */
function internalHelper(): void {}

/**
 * Escaped content with *\/ inside.
 *
 * @example
 * ```ts
 * withEscapedClose();
 * ```
 */
function withEscapedClose(): void {}

/**
 * Method with rest parameter.
 *
 * @param parts - path segments to join
 *
 * @returns joined path
 *
 * @example
 * ```ts
 * join('a', 'b', 'c'); // => 'a/b/c'
 * ```
 */
function join(...parts: string[]): string {
  return parts.join('/',);
}

/**
 * Options for the process function.
 */
type ProcessOptions = {
  /**
   * Item to process.
   */
  value: string;
  /**
   * Number of repetitions.
   */
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
 *
 * @example
 * ```ts
 * processDestructured({ value: 'ab', count: 3 }); // => 'ababab'
 * ```
 */
function processDestructured({ value, count, }: ProcessOptions,): string {
  return value.repeat(count,);
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
 *
 * @example
 * ```ts
 * mixedParams('>', { value: 'x', count: 2 }); // => '>xx'
 * ```
 */
function mixedParams(prefix: string, { value, count, }: ProcessOptions,): string {
  return prefix + value.repeat(count,);
}

export {
  greet,
  internalHelper,
  join,
  log,
  mixedParams,
  processDestructured,
  withEscapedClose,
};
