import { $ as pickNamed, } from '../p n/index.ts';

/**
 * Yields items from an iterable that are in the inclusion set.
 *
 * Filters an iterable by including only items present in the provided set.
 * Uses set membership for O(1) lookups per item.
 * Positional parameter variant that delegates to the named parameter version.
 *
 * @param iterable - Source iterable to filter
 *
 * @param toPick - Set of items to include in the output
 *
 * @param strict - When true (default), throws if any key in toPick is not found in the iterable.
 *   When false, silently ignores missing keys.
 *
 * @returns Items from the iterable that are in the inclusion set
 *
 * @throws Error if strict is true and any key in toPick is not found in the iterable
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const included = new Set([2, 4]);
 * const result = [...$(numbers, included)];
 * // [2, 4]
 * ```
 *
 * @example
 * ```ts
 * const words = ['apple', 'banana', 'cherry'];
 * const keep = new Set(['banana', 'cherry']);
 * for (const word of $(words, keep)) {
 *   console.log(word); // 'banana', 'cherry'
 * }
 * ```
 */
export function* $<T,>(
  iterable: Iterable<T>,
  toPick: ReadonlySet<T>,
  strict = true,
): Generator<T, void, undefined> {
  yield* pickNamed({
    iterable,
    toPick,
    strict,
  },);
}
