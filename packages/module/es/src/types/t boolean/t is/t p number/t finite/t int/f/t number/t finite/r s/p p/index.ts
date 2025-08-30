import type { $ as Finite, } from '@_/types/t number/t finite/t/index.ts';
import type {$ as Int} from '@_/types/t number/t finite/t int/t/index.ts';

export function $(
  value: Finite,
): value is Int {
  return Number.isInteger(value,);
}
