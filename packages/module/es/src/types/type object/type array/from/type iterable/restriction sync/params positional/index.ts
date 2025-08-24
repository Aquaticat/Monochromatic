import type { $, } from '../../../../../type iterable/type/restriction sync/index.ts';

export function $<const MyIterable extends $,>(
  iterable: MyIterable,
): MyIterable extends $<infer T> ? T[] : never {
  if (Array.isArray(iterable)) {
    return iterable as any;
  }
  return Array.from(iterable,) as any;
}
