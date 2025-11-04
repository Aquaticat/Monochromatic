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
 * Named parameters variant for better readability with explicit parameter names.
 *
 * @param params - Partition parameters
 * @param params.predicate - Synchronous function to test each item
 * @param params.iterable - Synchronous iterable to partition
 * @returns Object with pass, fail, and thrown arrays
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const result = partition({
 *   predicate: n => n % 2 === 0,
 *   iterable: numbers,
 * });
 * // result: { pass: [2, 4], fail: [1, 3, 5], thrown: [] }
 * ```
 *
 * @example
 * ```ts
 * const items = ['1', 'invalid', '3'];
 * const result = partition({
 *   predicate: s => {
 *     const num = Number.parseInt(s, 10);
 *     if (Number.isNaN(num)) throw new Error('Invalid');
 *     return num > 1;
 *   },
 *   iterable: items,
 * });
 * // result: { pass: ['3'], fail: ['1'], thrown: ['invalid'] }
 * ```
 */
export function $<T>(params: {
  predicate: (item: T) => boolean;
  iterable: Iterable<T>;
}): { pass: T[]; fail: T[]; thrown: T[] } {
  const { predicate, iterable } = params;
  const pass: T[] = [];
  const fail: T[] = [];
  const thrown: T[] = [];

  for (const item of iterable) {
    try {
      const result = predicate(item);
      if (result) {
        pass.push(item);
      } else {
        fail.push(item);
      }
    } catch {
      thrown.push(item);
    }
  }

  return { pass, fail, thrown };
}
