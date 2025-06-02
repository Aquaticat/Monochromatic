/**
 * @param iterable - The sequence to process.
 * @return The trimmed array. Returns an empty array if all elements are falsy.
 */
export function trimIterable<const T,>(iterable: Iterable<T>): T[] {
  const arr = [...iterable];
  const firstNonEmptyIndex = arr.findIndex(Boolean);
  if (firstNonEmptyIndex === -1) {
    return [];
  }

  const lastNonEmptyIndex = arr.toReversed().findIndex(Boolean);

  const lastIndex = arr.length - lastNonEmptyIndex - 1;

  return arr.slice(firstNonEmptyIndex, lastIndex + 1);
}

/**
 * Creates a new array from an iterable, removing elements from the beginning and end
 * for which the `predicateKeeps` function returns `false`.
 * The resulting array starts with the first element for which `predicateKeeps` returns `true`
 * and ends with the last element (from the original order) for which `predicateKeeps` returns `true`.
 * All elements between these two (inclusive) are included.
 * If `predicateKeeps` never returns `true` for any element, or if the iterable is empty,
 * an empty array is returned.
 * @template T The type of the elements in the iterable.
 * @param predicateKeeps A function that is called on elements from the iterable.
 *                       Return `true` to indicate an element should be kept (i.e., it's not to be trimmed from an end).
 *                       Return `false` to indicate an element should be trimmed if it's at an un-trimmed end.
 * @param iterable The iterable to process.
 * @return A new array containing the trimmed segment of the original iterable.
 *         Returns an empty array if no elements satisfy the `predicateKeeps` or the iterable is empty.
 */
export function trimIterableWith<const T,>(predicateKeeps: (elementToTest: T) => boolean,
  iterable: Iterable<T>): T[]
{
  const arr = [...iterable];
  const firstNonEmptyIndex = arr.findIndex(predicateKeeps);
  if (firstNonEmptyIndex === -1) {
    return [];
  }
  const lastNonEmptyIndex = arr.toReversed().findIndex(predicateKeeps);

  const lastIndex = arr.length - lastNonEmptyIndex - 1;

  return arr.slice(firstNonEmptyIndex, lastIndex + 1);
}
