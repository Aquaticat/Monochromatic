import type { $ as Negative, } from '@_/types/t number/t negative/t/index.ts';

export function $(
  value: number,
): value is Negative {
  return value < 0;
}
