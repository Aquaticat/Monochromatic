import { $ as partitionNamed } from '../p n/index.ts';

/**
 * Partitions an iterable into three arrays based on predicate evaluation results.
 *
 * Processes each item through the predicate and categorizes them:
 * - `pass`: Items where predicate returned true
 * - `fail`: Items where predicate returned false
 * - `thrown`: Items where predicate threw an error
 *
 * Handles both synchronous and asynchronous predicates and iterables.
 * All items are evaluated in order, and the predicate is awaited for each item.
 *
 * @param predicate - Function to test each item, can return boolean or Promise<boolean>
 * @param iterable - Iterable or AsyncIterable to partition
 * @returns Promise resolving to object with pass, fail, and thrown arrays
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const result = await partition(n => n % 2 === 0, numbers);
 * // result: { pass: [2, 4], fail: [1, 3, 5], thrown: [] }
 * ```
 *
 * @example
 * ```ts
 * const items = ['1', 'invalid', '3'];
 * const result = await partition(
 *   s => {
 *     const num = Number.parseInt(s, 10);
 *     if (Number.isNaN(num)) throw new Error('Invalid');
 *     return num > 1;
 *   },
 *   items
 * );
 * // result: { pass: ['3'], fail: ['1'], thrown: ['invalid'] }
 * ```
 */
export async function $<T>(
  predicate: (item: T) => boolean | Promise<boolean>,
  iterable: Iterable<T> | AsyncIterable<T>,
): Promise<{ pass: T[]; fail: T[]; thrown: T[] }> {
  return partitionNamed({ predicate, iterable });
}
