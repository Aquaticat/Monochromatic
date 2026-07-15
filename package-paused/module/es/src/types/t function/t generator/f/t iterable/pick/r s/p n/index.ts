/**
 * Yields items from an iterable that are in the inclusion set.
 *
 * Filters an iterable by including only items present in the provided set.
 * Uses set membership for O(1) lookups per item.
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
 * const result = [...$({ iterable: numbers, toPick: included })];
 * // [2, 4]
 * ```
 *
 * @example
 * ```ts
 * const words = ['apple', 'banana', 'cherry'];
 * const keep = new Set(['banana', 'cherry']);
 * for (const word of $({ iterable: words, toPick: keep })) {
 *   console.log(word); // 'banana', 'cherry'
 * }
 * ```
 *
 * @example Lenient mode ignores missing keys
 * ```ts
 * const numbers = [1, 2, 3];
 * const toPick = new Set([2, 99]); // 99 doesn't exist
 * const result = [...$({ iterable: numbers, toPick, strict: false })];
 * // [2] - no error thrown
 * ```
 */
export function* $<T,>(
  {
    iterable,
    toPick,
    strict = true,
  }: {
    iterable: Iterable<T>;
    toPick: ReadonlySet<T>;
    strict?: boolean;
  },
): Generator<T, void, undefined> {
  // Track which toPick keys were matched rather than all encountered items.
  // Memory: O(k) where k = toPick.size, instead of O(n) where n = iterable length.
  // Behavior is identical: we still detect missing keys because any key in toPick
  // that exists in the iterable will be added to matched, so matched.size < toPick.size
  // implies at least one key was never found.
  /**
   * Subset of toPick keys actually observed; used to detect missing-key errors under strict mode.
   */
  const matched = new Set<T>();

  for (const item of iterable) {
    if (toPick.has(item,)) {
      matched.add(item,);
      yield item;
    }
  }

  // Size comparison short-circuits validation when all keys matched.
  // If sizes differ, iterate to find the specific missing key for the error message.
  // Skip validation entirely when strict mode is disabled.
  if (strict && (matched.size
    !== toPick
    .size)) {
    for (const key of toPick) {
      if (!matched.has(key,))
        throw new Error(`Key not found in iterable: ${String(key,)}`,);
    }
  }
}
