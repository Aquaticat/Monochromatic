import { $ as partitionNamed } from '../p n/index.ts';

/**
 * Partitions an iterable into three arrays based on predicate evaluation results.
 *
 * Processes each item through the predicate and categorizes them:
 * - `pass`: Items where predicate returned true
 * - `fail`: Items where predicate returned false
 * - `thrown`: Items where predicate threw an error
 *
 * Synchronous-only variant optimized for performance when all operations are synchronous.
 * Use this when both the predicate and iterable are guaranteed to be synchronous.
 *
 * @param predicate - Synchronous function to test each item
 * @param iterable - Synchronous iterable to partition
 * @returns Object with pass, fail, and thrown arrays
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const result = partition(n => n % 2 === 0, numbers);
 * // result: { pass: [2, 4], fail: [1, 3, 5], thrown: [] }
 * ```
 *
 * @example
 * ```ts
 * const items = ['1', 'invalid', '3'];
 * const result = partition(
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
export function $<T>(
  predicate: (item: T) => boolean,
  iterable: Iterable<T>,
): { pass: T[]; fail: T[]; thrown: T[] } {
  return partitionNamed({ predicate, iterable });
}
