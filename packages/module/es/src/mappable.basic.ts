import type { Promisable, } from 'type-fest';
import type { Logged, } from './logged.basic.ts';

export type Mapper<T = unknown, Returns = unknown,> = (
  { element, index, mappable, l, }:
    & { element?: T; index?: number; mappable?: Mappable; }
    & Partial<Logged>,
) => Promisable<Returns>;

export type Mappable<T = unknown, Returns = unknown,> = {
  map: (
    { fn, l, }: { fn: Mapper<T, Returns>; } & Partial<Logged>,
  ) => Promisable<Returns>;
};

export type MapperSync<T = unknown, Returns = unknown,> = (
  { element, index, mappable, l, }:
    & { element?: T; index?: number; mappable?: Mappable; }
    & Partial<Logged>,
) => Returns;

export type MappableSync<T = unknown, Returns = unknown,> = {
  map: (
    { fn, l, }: { fn: Mapper<T, Returns>; } & Partial<Logged>,
  ) => Returns;
};
