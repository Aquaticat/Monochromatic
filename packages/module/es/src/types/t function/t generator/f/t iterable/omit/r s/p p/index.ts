import { $ as omitNamed, } from '../p n/index.ts';

/**
 * Yields items from an iterable that are not in the exclusion set.
 *
 * Filters an iterable by excluding items present in the provided set.
 * Uses set membership for O(1) lookups per item.
 * Positional parameter variant that delegates to the named parameter version.
 *
 * @param iterable - Source iterable to filter
 *
 * @param toOmit - Set of items to exclude from the output
 *
 * @param strict - When true (default), throws if any key in toOmit is not found in the iterable.
 *   When false, silently ignores missing keys.
 *
 * @returns Items from the iterable that are not in the exclusion set
 *
 * @throws Error if strict is true and any key in toOmit is not found in the iterable
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const excluded = new Set([2, 4]);
 * const result = [...$(numbers, excluded)];
 * // [1, 3, 5]
 * ```
 *
 * @example
 * ```ts
 * const words = ['apple', 'banana', 'cherry'];
 * const skip = new Set(['banana']);
 * for (const word of $(words, skip)) {
 *   console.log(word); // 'apple', 'cherry'
 * }
 * ```
 */
export function* $<T,>(
  iterable: Iterable<T>,
  toOmit: ReadonlySet<T>,
  strict = true,
): Generator<T, void, undefined> {
  yield* omitNamed({
    iterable,
    toOmit,
    strict,
  },);
}
