/**
 * Yields items from an iterable that are not in the exclusion set.
 *
 * Filters an iterable by excluding items present in the provided set.
 * Uses set membership for O(1) lookups per item.
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
 * const result = [...$({ iterable: numbers, toOmit: excluded })];
 * // [1, 3, 5]
 * ```
 *
 * @example
 * ```ts
 * const words = ['apple', 'banana', 'cherry'];
 * const skip = new Set(['banana']);
 * for (const word of $({ iterable: words, toOmit: skip })) {
 *   console.log(word); // 'apple', 'cherry'
 * }
 * ```
 *
 * @example Lenient mode ignores missing keys
 * ```ts
 * const numbers = [1, 2, 3];
 * const toOmit = new Set([2, 99]); // 99 doesn't exist
 * const result = [...$({ iterable: numbers, toOmit, strict: false })];
 * // [1, 3] - no error thrown
 * ```
 */
export function* $<T,>(
  {
    iterable,
    toOmit,
    strict = true,
  }: {
    iterable: Iterable<T>;
    toOmit: ReadonlySet<T>;
    strict?: boolean;
  },
): Generator<T, void, undefined> {
  // Track which toOmit keys were matched rather than all encountered items.
  // Memory: O(k) where k = toOmit.size, instead of O(n) where n = iterable length.
  // Behavior is identical: we still detect missing keys because any key in toOmit
  // that exists in the iterable will be added to matched, so matched.size < toOmit.size
  // implies at least one key was never found.
  /**
   * Subset of toOmit keys actually observed; used to detect missing-key errors under strict mode.
   */
  const matched = new Set<T>();

  for (const item of iterable) {
    if (toOmit.has(item,))
      matched.add(item,);
    else
      yield item;
  }

  // Size comparison short-circuits validation when all keys matched.
  // If sizes differ, iterate to find the specific missing key for the error message.
  // Skip validation entirely when strict mode is disabled.
  if (strict && (matched.size
    !== toOmit
    .size)) {
    for (const key of toOmit) {
      if (!matched.has(key,))
        throw new Error(`Key not found in iterable: ${String(key,)}`,);
    }
  }
}
