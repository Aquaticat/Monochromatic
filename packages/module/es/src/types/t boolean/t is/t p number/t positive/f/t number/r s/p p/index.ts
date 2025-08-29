import type { $ as Positive, } from '@_/types/type number/type positive/type/index.ts';

export function $(
  value: number,
): value is Positive {
  return value < 0;
}
