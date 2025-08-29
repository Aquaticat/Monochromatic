import type {$ as RangeInt} from '../../type/index.ts';

export type $<OfStrings extends Map<string, boolean>> = RangeInt & {
  __brand: {
    inQuotes: OfStrings;
  }
}
