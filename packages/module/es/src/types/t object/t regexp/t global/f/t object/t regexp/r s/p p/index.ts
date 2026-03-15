import type { $ as Global, } from '../../../../../t/index.ts';
import { $ as named, } from '../p n/index.ts';

/**
 * {@inheritDoc named}
 *
 * @param regexp - regular expression to convert to global
 *
 * @returns new RegExp with global flag set
 */
export function $(regexp: RegExp,): Global {
  return named({ regexp, },);
}
