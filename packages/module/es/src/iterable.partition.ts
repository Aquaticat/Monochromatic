/* TODO: Optimize performance for this function.
         We don't need to await for the current iterated element to be ready before moving on to the next iterated element. */

import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 * Partitions an iterable into two arrays based on an async predicate function.
 *
 * @deprecated Naming change. Use [`partitionIterableAsync()`](./iterable.partition.ts:28) instead. No need to write tests for it.
 * @param predicate - Function to test each element (can be sync or async)
 * @param arrayLike - Iterable to partition
 * @returns Tuple containing [matching elements, non-matching elements]
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const [evens, odds] = await partitionArrAsync(
 *   async (n) => n % 2 === 0,
 *   numbers
 * );
 * // evens: [2, 4], odds: [1, 3, 5]
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export async function partitionArrAsync<T_i,>(
  predicate: (i: T_i) => Promise<boolean> | boolean,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<[T_i[], T_i[]]> {
  const yes: T_i[] = [];
  const no: T_i[] = [];

  for await (const i of arrayLike) {
    if (await predicate(i)) {
      yes.push(i);
    } else {
      no.push(i);
    }
  }

  return [yes, no];
}

/**
 * Partitions an iterable into two arrays based on an async predicate function.
 * Processes all elements concurrently for optimal performance.
 *
 * @param predicate - Function to test each element (can be sync or async)
 * @param arrayLike - Iterable or async iterable to partition
 * @returns Tuple containing [matching elements, non-matching elements]
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const [evens, odds] = await partitionIterableAsync(
 *   async (n) => n % 2 === 0,
 *   numbers
 * );
 * // evens: [2, 4], odds: [1, 3, 5]
 * ```
 * @example
 * ```ts
 * // Works with async iterables
 * async function* asyncNumbers() {
 *   yield 1; yield 2; yield 3;
 * }
 *
 * const [evens, odds] = await partitionIterableAsync(
 *   async (n) => n % 2 === 0,
 *   asyncNumbers()
 * );
 * ```
 * @example
 * ```ts
 * // Concurrent processing for better performance
 * const urls = ['url1', 'url2', 'url3'];
 * const [valid, invalid] = await partitionIterableAsync(
 *   async (url) => {
 *     const response = await fetch(url);
 *     return response.ok;
 *   },
 *   urls
 * );
 * ```
 */
export async function partitionIterableAsync<T_i,>(
  predicate: (i: T_i) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<[T_i[], T_i[]]> {
  const yes: T_i[] = [];
  const no: T_i[] = [];
  const arr = await Array.fromAsync(arrayLike);

  const pairPromises: Promise<[T_i, boolean]>[] = arr.map(
    function toPairPromise(i: T_i): Promise<[T_i, boolean]> {
      return (async function pairPromise() {
        return [i, await predicate(i)];
      })();
    },
  );

  const pairs = await Promise.all(pairPromises);

  for (const [i, isYes] of pairs) {
    if (isYes) {
      yes.push(i);
    } else {
      no.push(i);
    }
  }

  return [yes, no];
}

/**
 * Partitions an iterable into two arrays based on a predicate function.
 * Synchronous version that processes elements sequentially.
 *
 * @param predicate - Function to test each element
 * @param arrayLike - Iterable to partition
 * @returns Tuple containing [matching elements, non-matching elements]
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const [evens, odds] = partitionIterable((n) => n % 2 === 0, numbers);
 * // evens: [2, 4], odds: [1, 3, 5]
 * ```
 * @example
 * ```ts
 * // Works with any iterable
 * const set = new Set([1, 2, 3, 4, 5]);
 * const [evens, odds] = partitionIterable((n) => n % 2 === 0, set);
 * ```
 * @example
 * ```ts
 * // Works with objects
 * const users = [
 *   { id: 1, active: true },
 *   { id: 2, active: false },
 *   { id: 3, active: true }
 * ];
 * const [active, inactive] = partitionIterable(
 *   (user) => user.active,
 *   users
 * );
 * ```
 */
export function partitionIterable<T_i,>(
  predicate: (i: T_i) => boolean,
  arrayLike: Iterable<T_i>,
): [T_i[], T_i[]] {
  const yes: T_i[] = [];
  const no: T_i[] = [];

  for (const i of arrayLike) {
    if (predicate(i)) {
      yes.push(i);
    } else {
      no.push(i);
    }
  }

  return [yes, no];
}
