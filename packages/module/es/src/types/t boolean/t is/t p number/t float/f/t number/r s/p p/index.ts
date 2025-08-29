import type {$ as Float} from '@_/types/type number/type float/type/index.ts';

export function $(
  value: number,
): value is Float {
  return !Number.isInteger(value,);
}
