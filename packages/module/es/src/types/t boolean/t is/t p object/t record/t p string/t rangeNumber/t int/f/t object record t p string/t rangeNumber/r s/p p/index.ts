import type {
  $ as RangeNumberInt,
} from '@_/types/t object/t record/t p string/t rangeNumber/t int/t/index.ts';
import type {
  $ as RangeNumber,
} from '@_/types/t object/t record/t p string/t rangeNumber/t/index.ts';

/**
 * Type guard to check if an object is a RangeNumberInt.
 * @param value - Object to check
 * @returns True if the object is a RangeNumberInt with integer bounds
 */
export function $(value: RangeNumber,): value is RangeNumberInt {
  const { startInclusive, endInclusive, } = value;

  // Check that both are integers
  if (!Number.isInteger(startInclusive,) || !Number.isInteger(endInclusive,))
    return false;

  // Check that startInclusive <= endInclusive
  return startInclusive <= endInclusive;
}
