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
  items: T[];
  keyFn: (item: T,) => number;
},): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const key = keyFn(item,);
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
