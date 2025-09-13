import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';
import type { $ as Positive, } from '@_/types/t number/t positive/t/index.ts';
import { $ as named, } from '../p n/index.ts';
export function $(
  length: Int & Positive,
): Generator<Int & (Positive | 0), void, undefined> {
  return named({ length, },);
}
