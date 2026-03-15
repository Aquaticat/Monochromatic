import { $ as pickNamed, } from '../p n/index.ts';

/**
 * Yields items from an iterable that are in the inclusion set.
 *
 * Filters an iterable by including only items present in the provided set.
 * Uses set membership for O(1) lookups per item.
 *
 * Handles both synchronous and asynchronous iterables.
 * Positional parameter variant that delegates to the named parameter version.
 *
 * @param iterable - Source iterable or async iterable to filter
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
 * const result: number[] = [];
 * for await (const n of $(numbers, included)) {
 *   result.push(n);
 * }
 * // result: [2, 4]
 * ```
 *
 * @example
 * ```ts
 * async function* asyncNumbers() {
 *   yield 1; yield 2; yield 3;
 * }
 * const keep = new Set([2]);
 * for await (const n of $(asyncNumbers(), keep)) {
 *   console.log(n); // 2
 * }
 * ```
 */
export async function* $<T,>(
  iterable: Iterable<T> | AsyncIterable<T>,
  toPick: ReadonlySet<T>,
  strict = true,
): AsyncGenerator<T, void, undefined> {
  yield* pickNamed({ iterable, toPick, strict, },);
}
