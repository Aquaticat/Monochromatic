export const numberLengthsToTestFirst = [1, 2, 4, 8, 16] as const;

/**
 * Build probe lengths list prefixed with the upper bound, then ascending candidates up to that bound.
 */
export function getLengthsToTestFirst(
  { lengthUpperBound, lengths }: { lengthUpperBound: number; lengths: readonly number[] },
): number[] {
  const result = [lengthUpperBound];
  for (const length of lengths) {
    if (length > lengthUpperBound)
      break;
    result.push(length);
  }
  return result;
}
