import type { Promisable, } from 'type-fest';
import type {
  MaybeAsyncIterable,
} from '../../../typeof/object/iterable/iterable.basic.ts';
import type { Logged, } from '../logged/logged.basic.ts';

export type Mapper<T = unknown, Returns = unknown,> = (
  { element, index, mappable, l, }:
    & { element?: T; index?: number; mappable?: T[]; }
    & Partial<Logged>,
) => Promisable<Returns>;

export type Mappable<T = unknown, Returns = unknown,> = {
  map: (
    { fn, l, }: { fn: Mapper<T, Returns>; } & Partial<Logged>,
  ) => MaybeAsyncIterable<Returns>;
};

export type MapperSync<T = unknown, Returns = unknown,> = (
  { element, index, mappable, l, }:
    & { element?: T; index?: number; mappable?: T[]; }
    & Partial<Logged>,
) => Returns;

export type MappableSync<T = unknown, Returns = unknown,> = {
  map: (
    { fn, l, }: { fn: MapperSync<T, Returns>; } & Partial<Logged>,
  ) => Iterable<Returns>;
};
