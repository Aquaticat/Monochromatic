/** Power of two: 4 */
const PROBE_4 = 4;
/** Power of two: 8 */
const PROBE_8 = 8;
/** Power of two: 16 */
const PROBE_16 = 16;
/** Power-of-two probe lengths used for binary-search-style length testing. */
export const numberLengthsToTestFirst = [
  1,
  2,
  PROBE_4,
  PROBE_8,
  PROBE_16,
] as const;

/**
 * Build probe lengths list prefixed with the upper bound, then ascending candidates up to that bound.
 *
 * @returns array of probe lengths starting with upper bound
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
