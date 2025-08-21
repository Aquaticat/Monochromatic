import type {
  IterableSync,
  MaybeAsyncIterable,
} from './iterable.basic.ts';

/**
 * Tests if a value is an Iterable but not an AsyncIterable.
 * This function specifically checks for synchronous iterables by looking for the Symbol.iterator method.
 * It will return false for AsyncIterables even though they may also have Symbol.iterator.
 *
 * @param value - Value to check for Iterable interface
 * @returns True if value implements Iterable<any>, false otherwise
 *
 * @example
 * ```ts
 * // Arrays are iterable
 * console.log(isIterable([1, 2, 3])); // true
 * console.log(isIterable('hello')); // true
 * console.log(isIterable(new Set([1, 2]))); // true
 * console.log(isIterable(new Map([['a', 1]]))); // true
 *
 * // Non-iterables
 * console.log(isIterable(42)); // false
 * console.log(isIterable({})); // false
 * console.log(isIterable(null)); // false
 *
 * // Generator functions return iterables
 * function* gen() { yield 1; }
 * console.log(isIterable(gen())); // true
 * ```
 */
export function isIterable<const MyValue extends Iterable<any> = Iterable<any>,>(
  value: MyValue,
): value is MyValue extends Iterable<infer T> ? MyValue & Iterable<T> : never {
  return typeof value === 'object'
    && value !== null
    && typeof (value as any)[Symbol.iterator] === 'function';
}

/**
 * Tests if a value is an AsyncIterable.
 * This function checks for the Symbol.asyncIterator method to determine if a value
 * can be used in async iteration contexts like `for await...of` loops.
 *
 * @param value - Value to check for AsyncIterable interface
 * @returns True if value implements AsyncIterable<any>, false otherwise
 *
 * @example
 * ```ts
 * // Async generators are async iterable
 * async function* asyncGen() { yield 1; yield 2; }
 * console.log(isAsyncIterable(asyncGen())); // true
 *
 * // Regular iterables aren't async iterable
 * console.log(isAsyncIterable([1, 2, 3])); // false
 * console.log(isAsyncIterable('hello')); // false
 *
 * // Non-iterables
 * console.log(isAsyncIterable(42)); // false
 * console.log(isAsyncIterable({})); // false
 *
 * // Custom async iterable
 * const customAsyncIterable = {
 *   async *[Symbol.asyncIterator]() {
 *     yield 1; yield 2;
 *   }
 * };
 * console.log(isAsyncIterable(customAsyncIterable)); // true
 * ```
 */
export function isAsyncIterable<
  const MyValue extends AsyncIterable<any> = AsyncIterable<any>,
>(
  value: MyValue,
): value is MyValue extends AsyncIterable<infer T> ? MyValue & AsyncIterable<T> : never {
  return typeof value === 'object'
    && value !== null
    && typeof (value as any)[Symbol.asyncIterator] === 'function';
}

/**
 * Tests if a value is either an Iterable or an AsyncIterable.
 * This function checks for both Symbol.iterator and Symbol.asyncIterator methods,
 * making it useful for functions that can handle both sync and async iteration.
 *
 * @param value - Value to check for either Iterable or AsyncIterable interface
 * @returns True if value implements Iterable<any> or AsyncIterable<any>, false otherwise
 *
 * @example
 * ```ts
 * // Sync iterables
 * console.log(isMaybeAsyncIterable([1, 2, 3])); // true
 * console.log(isMaybeAsyncIterable('hello')); // true
 * console.log(isMaybeAsyncIterable(new Set([1]))); // true
 *
 * // Async iterables
 * async function* asyncGen() { yield 1; }
 * console.log(isMaybeAsyncIterable(asyncGen())); // true
 *
 * // Non-iterables
 * console.log(isMaybeAsyncIterable(42)); // false
 * console.log(isMaybeAsyncIterable({})); // false
 * console.log(isMaybeAsyncIterable(null)); // false
 *
 * // Useful for generic iteration functions
 * function processIterable(data: unknown) {
 *   if (isMaybeAsyncIterable(data)) {
 *     // Can safely iterate over data
 *     return data;
 *   }
 *   throw new Error('Not iterable');
 * }
 * ```
 */
export function isMaybeAsyncIterable<
  const MyValue extends MaybeAsyncIterable<any> = MaybeAsyncIterable<any>,
>(
  value: MyValue,
): value is MyValue extends MaybeAsyncIterable<infer T> ? MyValue & MaybeAsyncIterable<T>
  : never
{
  return typeof value === 'object'
    && value !== null
    && (typeof (value as any)[Symbol.iterator] === 'function'
      || typeof (value as any)[Symbol.asyncIterator] === 'function');
}

export function isIterableSync<const MyValue extends IterableSync = IterableSync,>(
  value: MyValue,
): value is MyValue extends IterableSync<infer T> ? MyValue & IterableSync<T> : never {
  return typeof value === 'object'
    && value !== null
    && typeof value[Symbol.iterator] === 'function';
}
