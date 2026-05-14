// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type { Span, } from '@oxlint/plugins';

/**
 * Extracts the `[start, end]` byte range tuple from an untyped oxlint AST node.
 *
 * Every oxlint AST node carries a `.range` property but the plugin API
 * does not include it in the `Span` type.
 *
 * @param node - AST node with an untyped `.range` property
 *
 * @returns `[startOffset, endOffset]` byte range
 *
 * @example
 * ```ts
 * const [start, end] = rangeOf(node);
 * ```
 */
export function rangeOf(node: Span,): [
  number,
  number,
] {
  return (node as unknown as {
    range: [
      number,
      number,
    ];
  })
    .range;
}

/**
 * Parameters for {@link at}.
 */
export type AtParams<T,> = {
  /** Source array. */
  arr: T[];
  /** Numeric index. */
  index: number;
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
  /** Lookup captured into a const so the undefined branch can throw before returning. */
  const value = arr[index];
  if (value === undefined) {
    throw new Error(
      `Index ${String(index,)} out of bounds (length ${String(arr.length,)})`,
    );
  }

  return value;
}
