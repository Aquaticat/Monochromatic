/* oxlint-disable eslint/no-magic-numbers -- power-of-two probe sequence is self-documenting */
/** Power-of-two probe lengths used for binary-search-style length testing. */
export const numberLengthsToTestFirst = [
  1,
  2,
  4,
  8,
  16,
] as const;
/* oxlint-enable eslint/no-magic-numbers */

/**
 * Build probe lengths list prefixed with the upper bound, then ascending candidates up to that bound.
 *
 * @param lengthUpperBound - Maximum probe length to include
 *
 * @param lengths - Available probe lengths in ascending order
 *
 * @returns Array of probe lengths starting with upper bound, followed by ascending candidates
 *
 * @example
 * ```ts
 * getLengthsToTestFirst({ lengthUpperBound: 10, lengths: numberLengthsToTestFirst });
 * // [10, 1, 2, 4, 8]
 * ```
 */
export function getLengthsToTestFirst(
  {
    lengthUpperBound,
    lengths,
  }: {
    lengthUpperBound: number;
    lengths: readonly number[];
  },
): number[] {
  const result = [lengthUpperBound,];
  for (const length of lengths) {
    if (length > lengthUpperBound)
      break;
    result.push(length,);
  }
  return result;
}
