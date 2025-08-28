import type {
  $ as RangeNumberInt,
} from '@_/types/type object/type record/type param string/type rangeNumber/type int/type/index.ts';
import type {
  $ as StringUnknownRecord,
} from '@_/types/type object/type record/type param string/type/index.ts';

/**
 * Type guard to check if an object is a RangeNumberInt.
 * @param value - Object to check
 * @returns True if the object is a RangeNumberInt with integer bounds
 */
export function $(value: StringUnknownRecord,): value is RangeNumberInt {
  const { startInclusive, endInclusive, } = value;

  // Check that both properties are numbers
  if (typeof startInclusive !== 'number' || typeof endInclusive !== 'number')
    return false;

  // Check that both are integers
  if (!Number.isInteger(startInclusive,) || !Number.isInteger(endInclusive,))
    return false;

  // Check that startInclusive <= endInclusive
  return startInclusive <= endInclusive;
}
