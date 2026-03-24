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
  }).range;
}

/**
 * Safely indexes into an array, throwing on out-of-bounds access.
 *
 * Replaces `arr[i]!` which is banned by no-non-null-assertion.
 *
 * @param arr - source array
 *
 * @param index - numeric index
 *
 * @returns element at index
 *
 * @throws when index is out of bounds
 */
export function at<T>(
  arr: T[],
  index: number,
): T {
  const value = arr[index];
  if (value === undefined)
    throw new Error(`Index ${String(index)} out of bounds (length ${String(arr.length)})`,);

  return value;
}
