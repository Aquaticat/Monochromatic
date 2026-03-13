import { $ as omitNamed, } from '../p n/index.ts';

/**
 * Yields items from an iterable that are not in the exclusion set.
 *
 * Filters an iterable by excluding items present in the provided set.
 * Uses set membership for O(1) lookups per item.
 *
 * Handles both synchronous and asynchronous iterables.
 * Positional parameter variant that delegates to the named parameter version.
 *
 * @param iterable - Source iterable or async iterable to filter
 *
 * @param toOmit - Set of items to exclude from the output
 *
 * @param strict - When true (default), throws if any key in toOmit is not found in the iterable.
 *   When false, silently ignores missing keys.
 *
 * @yields Items from the iterable that are not in the exclusion set
 *
 * @throws Error if strict is true and any key in toOmit is not found in the iterable
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const excluded = new Set([2, 4]);
 * const result: number[] = [];
 * for await (const n of $(numbers, excluded)) {
 *   result.push(n);
 * }
 * // result: [1, 3, 5]
 * ```
 *
 * @example
 * ```ts
 * async function* asyncNumbers() {
 *   yield 1; yield 2; yield 3;
 * }
 * const skip = new Set([2]);
 * for await (const n of $(asyncNumbers(), skip)) {
 *   console.log(n); // 1, 3
 * }
 * ```
 */
export async function* $<T,>(
  iterable: Iterable<T> | AsyncIterable<T>,
  toOmit: ReadonlySet<T>,
  strict = true,
): AsyncGenerator<T, void, undefined> {
  yield* omitNamed({ iterable, toOmit, strict, },);
}
