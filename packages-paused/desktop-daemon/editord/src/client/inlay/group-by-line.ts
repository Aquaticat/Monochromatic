/**
 * Generic line-number grouping utility.
 *
 * Groups items by a numeric key extracted from each item,
 * used by the inlay layer to bucket hints and diagnostics per line.
 */

/**
 * Groups items by a numeric key extracted from each item.
 *
 * @param items - items to group
 *
 * @param keyFn - extracts grouping key from each item
 *
 * @returns map from key to grouped items
 *
 * @example
 * ```ts
 * const result = groupByLine({ items: [{ label: "useState", detail: "function" }], keyFn: function getLine(item) { return item.position.line; }, });
 * ```
 */
export function groupByLine<T,>({
  items,
  keyFn,
}: {
  readonly items: readonly T[];
  readonly keyFn: (item: T,) => number;
},): Map<number, T[]> {
  /**
   * Line-keyed map; values are accumulated as items are processed.
   */
  const groups = new Map<number, T[]>();
  for (const item of items) {
    /**
     * Computed once per item to avoid two `keyFn` calls in the get/set pair.
     */
    const key = keyFn(item,);
    /**
     * Existing bucket reused; undefined triggers lazy creation.
     */
    let group = groups.get(key,);
    if (group === undefined) {
      group = [];
      groups.set(
        key,
        group,
      );
    }
    group.push(item,);
  }
  return groups;
}
