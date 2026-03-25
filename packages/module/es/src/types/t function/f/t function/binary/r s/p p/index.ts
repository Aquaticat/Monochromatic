/**
 * Wraps a function to accept only its first two arguments.
 *
 * Useful to prevent unexpected behavior from extra arguments passed by iterators
 * like `Array.prototype.map`, which passes `(element, index, array)`.
 *
 * @param fn - Function to wrap
 *
 * @returns Binary version that ignores all but first two arguments
 *
 * @example
 * ```ts
 * function add(a: number, b: number) { return a + b; }
 * const binaryAdd = $(add);
 * [1, 2, 3].map(binaryAdd); // only passes (element, index)
 * ```
 *
 * @example
 * Partial application with `.map`:
 * ```ts
 * function renderItem(item: Item, index: number) { return `${index}: ${item.name}`; }
 * items.map($(renderItem));
 * ```
 */
export function $<
  const Fn extends (a: Parameters<Fn>[0], b: Parameters<Fn>[1],) => ReturnType<Fn>,
>(
  fn: Fn,
): (a: Parameters<Fn>[0], b: Parameters<Fn>[1],) => ReturnType<Fn> {
  return function binary(
    a: Parameters<Fn>[0],
    b: Parameters<Fn>[1],
  ): ReturnType<Fn> {
    return fn(
      a,
      b,
    );
  };
}
