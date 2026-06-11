/**
 * Takes the first n elements from an iterable, collecting them into an array.
 * Stops iteration early once the requested number of elements is reached, making it
 * efficient for processing only the beginning of large or infinite sequences.
 * Handles both synchronous and asynchronous iterables seamlessly.
 *
 * @param count - Number of elements to take from the beginning (must be non-negative)
 *
 * @param iterable - Iterable to take elements from
 *
 * @returns Array containing up to count elements from the beginning
 *
 * @example
 * Take from array:
 * ```ts
 * const first3 = $({ count: 3, iterable: [1, 2, 3, 4, 5] });
 * console.log(first3); // [1, 2, 3]
 * ```
 *
 * @example
 * Take from Set:
 * ```ts
 * const set = new Set(['a', 'b', 'c', 'd']);
 * const first2 = $({ count: 2, iterable: set });
 * console.log(first2); // ['a', 'b']
 * ```
 *
 * @example
 * Take fewer than available:
 * ```ts
 * const all = $({ count: 10, iterable: [1, 2, 3] });
 * console.log(all); // [1, 2, 3]
 * ```
 *
 * @example
 * Take from generator:
 * ```ts
 * function* fibonacci() {
 *   let a = 0, b = 1;
 *   while (true) {
 *     yield a;
 *     [a, b] = [b, a + b];
 *   }
 * }
 * const firstFibs = $({ count: 8, iterable: fibonacci() });
 * console.log(firstFibs); // [0, 1, 1, 2, 3, 5, 8, 13]
 * ```
 *
 * @example
 * Take zero elements:
 * ```ts
 * const none = $({ count: 0, iterable: [1, 2, 3] });
 * console.log(none); // []
 * ```
 *
 * @example
 * Take from string (iterable characters):
 * ```ts
 * const firstChars = $({ count: 3, iterable: 'hello world' });
 * console.log(firstChars); // ['h', 'e', 'l']
 * ```
 *
 * @example
 * Early termination with infinite sequences:
 * ```ts
 * function* naturalNumbers() {
 *   let n = 1;
 *   while (true) yield n++;
 * }
 *
 * const first5 = $({ count: 5, iterable: naturalNumbers() });
 * console.log(first5); // [1, 2, 3, 4, 5]
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<const T,>({
  count,
  iterable,
}: {
  count: number;
  iterable: Iterable<T>;
},): T[] {
  if (count < 0)
    throw new RangeError('Count must be non-negative',);
  if (count === 0)
    return [];

  /**
   * Accumulator of taken elements up to the requested count.
   */
  const result: T[] = [];

  for (const element of iterable) {
    result.push(element,);
    if (result.length
      >= count)
      break;
  }

  return result;
}
