import {$ as named } from '../p n/index.ts';
/**
 * {@inheritDoc named}
 */
export function $(str: string,): RegExp {
  return named({str});
}
