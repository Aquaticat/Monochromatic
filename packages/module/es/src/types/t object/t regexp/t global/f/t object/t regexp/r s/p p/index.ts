import type { $ as Global, } from '../../../../../t/index.ts';
import { $ as named, } from '../p n/index.ts';

/** {@inheritdoc named} */
export function $(regexp: RegExp,): Global {
  return named({ regexp, },);
}
