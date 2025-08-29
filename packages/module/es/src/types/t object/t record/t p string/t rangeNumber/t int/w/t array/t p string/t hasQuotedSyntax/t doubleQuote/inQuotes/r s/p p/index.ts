import type {
  $ as DoubleQuote,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t/index.ts';
import type { $ as Value, } from '../../../../../../../../t/index.ts';

export function $(value: Value, strs: DoubleQuote[],): Value {
  // for each str, check if effective (unescaped) quotes before value.startInclusive are evenly paired.

  // merge new map with original
}
