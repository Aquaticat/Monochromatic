/**
 * Removes falsy elements from the beginning and end of an iterable, keeping all elements
 * between the first and last truthy values. This is similar to string trim() but operates
 * on iterables with truthy/falsy semantics.
 *
 * @param iterable - Sequence to process by removing leading and trailing falsy elements
 * @returns New array with falsy elements trimmed from both ends, empty if all elements are falsy
 * @example
 * ```ts
 * // Remove falsy values from ends
 * const result = trimIterable([0, false, 1, 2, 0, 3, null, '']);
 * // [1, 2, 0, 3] - keeps truthy values and falsy values between them
 *
 * // Works with any iterable
 * const set = new Set([null, 'hello', '', 'world', undefined]);
 * const trimmed = trimIterable(set); // ['hello', '', 'world']
 *
 * // All falsy returns empty
 * const empty = trimIterable([0, false, null, '']); // []
 *
 * // Already trimmed
 * const clean = trimIterable([1, 2, 3]); // [1, 2, 3]
 * ```
 */
export function trimIterable<const T,>(iterable: Iterable<T>,): T[] {
  const arr = [...iterable,];
  const firstNonEmptyIndex = arr.findIndex(Boolean,);
  if (firstNonEmptyIndex === -1)
    return [];

  const lastNonEmptyIndex = arr.toReversed().findIndex(Boolean,);

  const lastIndex = arr.length - lastNonEmptyIndex - 1;

  return arr.slice(firstNonEmptyIndex, lastIndex + 1,);
}

/**
 * Removes elements from the beginning and end of an iterable based on a custom predicate,
 * keeping all elements between the first and last elements that satisfy the predicate.
 * This provides flexible trimming logic beyond simple truthy/falsy checks.
 *
 * @param predicateKeeps - Function to test each element, returns true to keep element from trimming
 * @param iterable - Sequence to process by removing leading and trailing elements that fail predicate
 * @returns New array with elements trimmed from both ends based on predicate, empty if no elements satisfy predicate
 * @example
 * ```ts
 * // Trim whitespace-like strings
 * const strings = ['  ', '', 'hello', '  ', 'world', '', '   '];
 * const trimmed = trimIterableWith(s => s.trim() !== '', strings);
 * // ['hello', '  ', 'world'] - keeps content and spaces between
 *
 * // Trim numbers below threshold
 * const numbers = [1, 0, 5, 2, 1, 8, 0, 1];
 * const filtered = trimIterableWith(n => n >= 2, numbers);
 * // [5, 2, 1, 8] - keeps numbers >= 2 and all between first/last match
 *
 * // Trim non-alphabetical characters
 * const chars = ['!', '@', 'a', '1', 'b', 'c', '#', '$'];
 * const letters = trimIterableWith(c => /[a-zA-Z]/.test(c), chars);
 * // ['a', '1', 'b', 'c'] - keeps letters and anything between
 *
 * // No matches returns empty
 * const none = trimIterableWith(x => false, [1, 2, 3]); // []
 * ```
 */
export function trimIterableWith<const T,>(predicateKeeps: (elementToTest: T,) => boolean,
  iterable: Iterable<T>,): T[]
{
  const arr = [...iterable,];
  const firstNonEmptyIndex = arr.findIndex(predicateKeeps,);
  if (firstNonEmptyIndex === -1)
    return [];
  const lastNonEmptyIndex = arr.toReversed().findIndex(predicateKeeps,);

  const lastIndex = arr.length - lastNonEmptyIndex - 1;

  return arr.slice(firstNonEmptyIndex, lastIndex + 1,);
}
