/**
 * Type guard that checks if a value is a Promise or thenable object.
 * Uses duck typing to detect promise-like objects by checking for the presence
 * of a `then` method, which is the standard approach for thenable detection.
 *
 * @param value - Value to check for Promise compatibility
 * @returns True if value has a `then` method (is thenable), false otherwise
 *
 * @example
 * ```ts
 * const promiseValue = Promise.resolve(42);
 * const regularValue = 42;
 *
 * if (isPromise(promiseValue)) {
 *   // TypeScript knows this is Promise<any>
 *   promiseValue.then(result => console.log(result));
 * }
 *
 * if (isPromise(regularValue)) {
 *   // This block won't execute
 * } else {
 *   // TypeScript knows this isn't a Promise
 *   console.log(regularValue);
 * }
 *
 * // Useful for handling mixed Promise/non-Promise values
 * function handleValue(value: unknown) {
 *   if (isPromise(value)) {
 *     return value.then(result => process(result));
 *   }
 *   return process(value);
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isPromise(value: any): value is Promise<any> {
  return typeof value?.then === 'function';
}
