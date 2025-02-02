import type { MaybeAsyncIterable } from './arrayLike.type.maybe.ts';

// See https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-1.html#mapped-types-on-tuples-and-arrays
/* @__NO_SIDE_EFFECTS__ */ export type MapArrayToMaybeAsyncIterables<
  T_array extends any[],
> = {
  [K in keyof T_array]: MaybeAsyncIterable<T_array[K]>;
};

/* @__NO_SIDE_EFFECTS__ */ export type MapArrayToIterables<T_array extends any[],> = {
  [K in keyof T_array]: Iterable<T_array[K]>;
};
