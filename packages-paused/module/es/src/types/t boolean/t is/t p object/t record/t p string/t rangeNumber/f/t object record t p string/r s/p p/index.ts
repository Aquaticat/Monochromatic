import type {
  $ as RangeNumber,
} from '@_/types/t object/t record/t p string/t rangeNumber/t/index.ts';
import type {
  $ as StringUnknownRecord,
} from '@_/types/t object/t record/t p string/t/index.ts';

/**
 * Type guard checking whether a record represents a valid numeric range
 * where `startInclusive` is less than or equal to `endInclusive`.
 *
 * @param value - record to validate as a numeric range
 *
 * @returns `true` when both bounds are numbers and start does not exceed end
 *
 * @example
 * ```ts
 * $({ startInclusive: 1, endInclusive: 10 }); // true
 * $({ startInclusive: 10, endInclusive: 1 }); // false
 * $({ startInclusive: 'a', endInclusive: 5 }); // false
 * ```
 */
export function $(value: StringUnknownRecord,): value is RangeNumber {
  /**
   * Bounds destructured for the range comparison below.
   */
  const {
    startInclusive,
    endInclusive,
  } = value;
  if (((typeof startInclusive) === 'number') && ((typeof endInclusive) === 'number'))
    return startInclusive <= endInclusive;

  return false;
}
