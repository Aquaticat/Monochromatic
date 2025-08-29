import type {$ as NumberInt} from '@_/types/type number/type int/type/index.ts';

export function $(
  value: unknown,
): value is NumberInt {
  return Number.isInteger(value,);
}
