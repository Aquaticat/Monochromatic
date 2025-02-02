import type { MaybeAsyncIterable } from './arrayLike.type.maybe.ts';
export type MapArrayToMaybeAsyncIterables<T_array extends any[]> = {
    [K in keyof T_array]: MaybeAsyncIterable<T_array[K]>;
};
export type MapArrayToIterables<T_array extends any[]> = {
    [K in keyof T_array]: Iterable<T_array[K]>;
};
