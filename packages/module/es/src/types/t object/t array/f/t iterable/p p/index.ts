import type { $, } from '../../../../type iterable/type/index.ts';

export function $<const MyIterable extends $,>(
  iterable: MyIterable,
): MyIterable extends $<infer T> ? T[] : never {
  if (Array.isArray(iterable)) {
    return iterable as any;
  }
  return Array.fromAsync(iterable,) as any;
}
