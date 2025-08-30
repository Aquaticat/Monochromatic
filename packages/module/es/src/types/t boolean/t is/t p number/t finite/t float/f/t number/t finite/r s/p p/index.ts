import type {$ as Finite} from '@_/types/t number/t finite/t/index.ts';
import type { $ as Float, } from '@/src/types/t number/t finite/t float/t/index.ts';

export function $(
  value: Finite,
): value is Float {
  return !Number.isInteger(value,);
}
