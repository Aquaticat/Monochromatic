import type { $ as Float, } from '@_/types/t number/t float/t/index.ts';

export function $(
  value: number,
): value is Float {
  return !Number.isInteger(value,);
}
