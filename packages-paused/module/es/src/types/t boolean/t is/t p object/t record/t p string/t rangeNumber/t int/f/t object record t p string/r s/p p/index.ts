import type {
  $ as RangeNumberInt,
} from '@_/types/t object/t record/t p string/t rangeNumber/t int/t/index.ts';
import type {
  $ as StringUnknownRecord,
} from '@_/types/t object/t record/t p string/t/index.ts';

/**
 * t guard to check if an object is a RangeNumberInt.
 *
 * @param value - Object to check
 *
 * @returns True if the object is a RangeNumberInt with integer bounds
 *
 * @example
 * ```ts
 * $({ startInclusive: 0, endInclusive: 5 }); // true
 * $({ startInclusive: 'a', endInclusive: 5 }); // false (non-number)
 * $({ startInclusive: 1.5, endInclusive: 3 }); // false (non-integer)
 * ```
 */
export function $(value: StringUnknownRecord,): value is RangeNumberInt {
  /**
   * Bounds destructured for the integer-range validation below.
   */
  const {
    startInclusive,
    endInclusive,
  } = value;

  // Check that both properties are numbers
  if (((typeof startInclusive) !== 'number') || ((typeof endInclusive) !== 'number'))
    return false;

  // Check that both are integers
  if ((!Number.isInteger(startInclusive,)) || (!Number.isInteger(endInclusive,)))
    return false;

  // Check that startInclusive <= endInclusive
  return startInclusive <= endInclusive;
}
