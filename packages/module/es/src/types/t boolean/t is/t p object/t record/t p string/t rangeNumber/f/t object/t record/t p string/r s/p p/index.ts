import type {
  $ as RangeNumber,
} from '@_/types/type object/type record/type param string/type rangeNumber/type/index.ts';
import type {
  $ as StringUnknownRecord,
} from '@_/types/type object/type record/type param string/type/index.ts';

export function $(value: StringUnknownRecord,): value is RangeNumber {
  const {startInclusive, endInclusive} = value;
  if (typeof startInclusive === 'number' && typeof endInclusive === 'number') {
    return startInclusive <= endInclusive;
  }

  return false;
}
