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
 * if ($(promiseValue)) {
 *   // TypeScript knows this is Promise<any>
 *   promiseValue.then(result => console.log(result));
 * }
 *
 * if ($(regularValue)) {
 *   // This block won't execute
 * } else {
 *   // TypeScript knows this isn't a Promise
 *   console.log(regularValue);
 * }
 *
 * // Useful for handling mixed Promise/non-Promise values
 * function handleValue(value: unknown) {
 *   if ($(value)) {
 *     return value.then(result => process(result));
 *   }
 *   return process(value);
 * }
 *
 * // Works with custom thenable objects
 * const customThenable = {
 *   then: (resolve) => resolve('custom')
 * };
 * $(customThenable); // true
 * ```
 */
export function $<const MyValue,>(
  value: MyValue,
): value is MyValue extends Promise<infer T> ? MyValue & Promise<T>
  : MyValue & Promise<unknown>
{
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- could be thenable
  return typeof (value as any)?.then === 'function';
}
