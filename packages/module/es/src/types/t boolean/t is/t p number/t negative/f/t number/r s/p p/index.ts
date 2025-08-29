import type {$ as Negative} from '@_/types/type number/type negative/type/index.ts';

export function $(
  value: number,
): value is Negative {
  return value < 0;
}
