import type { $ as Positive, } from '@_/types/t number/t positive/t/index.ts';

export function $(
  value: number,
): value is Positive {
  return value > 0;
}
