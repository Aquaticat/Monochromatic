import type {$ as NumberInt} from '@_/types/t number/t int/t/index.ts';

export function $(
  value: unknown,
): value is NumberInt {
  return Number.isInteger(value,);
}
