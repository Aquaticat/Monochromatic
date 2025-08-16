/**
 * Tests if a value is an AsyncGenerator instance.
 * AsyncGenerators are created by async generator functions and can be used with `for await...of`.
 *
 * @param value - Value to check for AsyncGenerator type
 * @returns True if value is an AsyncGenerator instance, false otherwise
 *
 * @example
 * ```ts
 * async function* asyncGenFunc() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * function* syncGenFunc() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * const asyncGen = asyncGenFunc();
 * const syncGen = syncGenFunc();
 *
 * console.log(isAsyncGenerator(asyncGen)); // true
 * console.log(isAsyncGenerator(syncGen)); // false
 * console.log(isAsyncGenerator([1, 2])); // false
 *
 * // AsyncGenerators are also async iterable
 * console.log(isAsyncIterable(asyncGen)); // true
 *
 * // Usage with for await...of
 * for await (const value of asyncGenFunc()) {
 *   console.log(value); // 1, 2
 * }
 * ```
 */
export function isAsyncGenerator(
  value: unknown,
): value is AsyncGenerator {
  return Object.prototype.toString.call(value,) === '[object AsyncGenerator]';
}

/**
 * Tests if a value is a Generator instance.
 * Generators are created by generator functions and can be used with `for...of` loops.
 *
 * @param value - Value to check for Generator type
 * @returns True if value is a Generator instance, false otherwise
 *
 * @example
 * ```ts
 * function* genFunc() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * async function* asyncGenFunc() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * const gen = genFunc();
 * const asyncGen = asyncGenFunc();
 *
 * console.log(isGenerator(gen)); // true
 * console.log(isGenerator(asyncGen)); // false
 * console.log(isGenerator([1, 2])); // false
 * console.log(isGenerator('hello')); // false
 *
 * // Generators are iterable
 * console.log(isIterable(gen)); // true
 *
 * // Usage with for...of
 * for (const value of genFunc()) {
 *   console.log(value); // 1, 2
 * }
 * ```
 */
export function isGenerator(
  value: unknown,
): value is Generator {
  return Object.prototype.toString.call(value,) === '[object Generator]';
}