import type { MaybeAsyncIterable, } from './iterable.basic.ts';

/**
 * Maps each element of an array type to a MaybeAsyncIterable of that element's type.
 * Preserves the array structure and length while transforming element types.
 *
 * @template T_array - Array type to transform
 * @example
 * ```ts
 * type Example = MapArrayToMaybeAsyncIterables<[string, number]>;
 * // Result: [MaybeAsyncIterable<string>, MaybeAsyncIterable<number>]
 * ```
 *
 * @see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-1.html#mapped-types-on-tuples-and-arrays
 */
export type MapArrayToMaybeAsyncIterables<
  T_array extends any[],
> = {
  [K in keyof T_array]: MaybeAsyncIterable<T_array[K]>;
};

/**
 * Maps each element of an array type to an Iterable of that element's type.
 * Preserves the array structure and length while transforming element types.
 *
 * @template T_array - Array type to transform
 * @example
 * ```ts
 * type Example = MapArrayToIterables<[string, number]>;
 * // Result: [Iterable<string>, Iterable<number>]
 * ```
 *
 * @see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-1.html#mapped-types-on-tuples-and-arrays
 */
export type MapArrayToIterables<T_array extends any[],> = {
  [K in keyof T_array]: Iterable<T_array[K]>;
};
