import { $ as named, } from '../p n/index.ts';
/**
 * {@inheritDoc named}
 *
 * @param str - string to convert to RegExp
 *
 * @returns RegExp compiled from source string
 */
export function $(str: string,): RegExp {
  return named({ str, },);
}
