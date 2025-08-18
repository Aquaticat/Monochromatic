import type { Promisable, } from 'type-fest';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import type { Logged, } from './logged.basic.ts';

export type LimitedMapper<T = unknown, Returns = unknown,> = (
  { element, index, l, }:
    & { element?: T; index?: number; }
    & Partial<Logged>,
) => Promisable<Returns>;

export type LimitedMappable<T = unknown, Returns = unknown,> = {
  map: (
    { fn, l, }: { fn: LimitedMapper<T, Returns>; } & Partial<Logged>,
  ) => MaybeAsyncIterable<Returns>;
};

export type LimitedMapperSync<T = unknown, Returns = unknown,> = (
  { element, index, l, }:
    & { element?: T; index?: number; }
    & Partial<Logged>,
) => Returns;

export type LimitedMappableSync<T = unknown, Returns = unknown,> = {
  map: (
    { fn, l, }: { fn: LimitedMapperSync<T, Returns>; } & Partial<Logged>,
  ) => Iterable<Returns>;
};
