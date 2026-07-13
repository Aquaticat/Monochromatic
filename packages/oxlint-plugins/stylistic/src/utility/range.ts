import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { Span, } from '@oxlint/plugins';

/**
 * Extracts the `[start, end]` byte range tuple from an oxlint AST node.
 *
 * The installed oxlint plugin API exposes `range` on {@link Span}, so callers can
 * share one helper without reasserting the property in each rule.
 *
 * @param node - AST node carrying a `.range` property
 *
 * @returns `[startOffset, endOffset]` byte range
 *
 * @example
 * ```ts
 * const [start, end] = rangeOf(node);
 * ```
 */
export function rangeOf(node: ForeignBorrowed<Span>,): [
  number,
  number,
] {
  return node.range;
}

/**
 * Parameters for {@link at}.
 */
export type AtParams<T,> = {
  /**
   * Source array.
   */
  readonly arr: readonly T[];
  /**
   * Numeric index.
   */
  readonly index: number;
};

/**
 * Safely indexes into an array, throwing on out-of-bounds access.
 *
 * Replaces `arr[i]!` which is banned by no-non-null-assertion.
 *
 * @returns element at index
 *
 * @throws when index is out of bounds
 *
 * @example
 * ```ts
 * const first = at({ arr: items, index: 0 });
 * ```
 */
export function at<T,>({
  arr,
  index,
}: AtParams<T>,): T {
  /**
   * Lookup captured into a const so the undefined branch can throw before returning.
   */
  const value = arr[index];
  if (value === undefined) {
    throw new Error(
      `Index ${String(index,)} out of bounds (length ${String(arr.length,)})`,
    );
  }

  return value;
}
