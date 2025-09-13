import type {
  $ as RangeNumber,
} from '@_/types/t object/t record/t p string/t rangeNumber/t/index.ts';
import type {
  $ as StringUnknownRecord,
} from '@_/types/t object/t record/t p string/t/index.ts';

export function $(value: StringUnknownRecord,): value is RangeNumber {
  const { startInclusive, endInclusive, } = value;
  if (typeof startInclusive === 'number' && typeof endInclusive === 'number')
    return startInclusive <= endInclusive;

  return false;
}
