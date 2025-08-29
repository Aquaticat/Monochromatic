import type { $ as Positive, } from '@_/types/t numeric/t positive/t/index.ts';

export function $(
  value: number | bigint,
): value is Positive {
  return value > 0;
}
