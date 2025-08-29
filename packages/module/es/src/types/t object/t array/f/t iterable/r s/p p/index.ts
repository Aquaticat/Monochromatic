import type { $, } from '../../../../../t iterable/t/r s/index.ts';

export function $<const MyIterable extends $,>(
  iterable: MyIterable,
): MyIterable extends $<infer T> ? T[] : never {
  if (Array.isArray(iterable,))
    return iterable as any;
  return Array.from(iterable,) as any;
}
