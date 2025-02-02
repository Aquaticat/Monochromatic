// TODO: Need to figure out how to construct a union type like [1] | [1, 2] | [1, 2, 3] | ...

import {
  arrayFrom,
  arrayFromAsync,
} from './arrayLike.from.ts';
import {
  mapArrayLike,
  mapArrayLikeAsync,
} from './arrayLike.map.ts';
import type {
  MapArrayToIterables,
  MapArrayToMaybeAsyncIterables,
  MaybeAsyncIterable,
} from './arrayLike.type.ts';
import { unary } from './function.ts';

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_0,>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0]>
): Promise<T_0[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_0, T_1,>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1]>
): Promise<(T_0 | T_1)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_0, T_1, T_2,>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2]>
): Promise<(T_0 | T_1 | T_2)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_0, T_1, T_2,
  T_3,>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2, T_3]>
): Promise<(T_0 | T_1 | T_2 | T_3)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_0, T_1, T_2, T_3,
  T_4,>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2, T_3, T_4]>
): Promise<(T_0 | T_1 | T_2 | T_3 | T_4)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_0, T_1, T_2, T_3,
  T_4, T_5,>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2, T_3, T_4, T_5]>
): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_0, T_1, T_2, T_3,
  T_4, T_5, T_6,>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2, T_3, T_4, T_5, T_6]>
): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_0, T_1, T_2, T_3,
  T_4, T_5, T_6, T_7,>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<
    [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]
  >
): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<
  T_0,
  T_1,
  T_2,
  T_3,
  T_4,
  T_5,
  T_6,
  T_7,
  T_8,
>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<
    [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]
  >
): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<
  T_0,
  T_1,
  T_2,
  T_3,
  T_4,
  T_5,
  T_6,
  T_7,
  T_8,
  T_9,
>(
  ...arrayLikes: MapArrayToMaybeAsyncIterables<
    [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]
  >
): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8 | T_9)[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync<T_same,>(
  ...arrayLikes: MaybeAsyncIterable<T_same>[]
): Promise<T_same[]>;

/* @__NO_SIDE_EFFECTS__ */ export async function concatArrayLikesAsync(
  ...arrayLikes: MaybeAsyncIterable<unknown>[]
): Promise<unknown[]> {
  const arrayOfArrays: unknown[][] = await mapArrayLikeAsync(unary(arrayFromAsync),
    arrayLikes);

  return arrayOfArrays.flat();
}

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_0,>(
  ...arrayLikes: MapArrayToIterables<[T_0]>
): T_0[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_0, T_1,>(
  ...arrayLikes: MapArrayToIterables<[T_0, T_1]>
): (T_0 | T_1)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_0, T_1, T_2,>(
  ...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2]>
): (T_0 | T_1 | T_2)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_0, T_1, T_2, T_3,>(
  ...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2, T_3]>
): (T_0 | T_1 | T_2 | T_3)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_0, T_1, T_2, T_3, T_4,>(
  ...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2, T_3, T_4]>
): (T_0 | T_1 | T_2 | T_3 | T_4)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_0, T_1, T_2, T_3, T_4,
  T_5,>(
  ...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2, T_3, T_4, T_5]>
): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_0, T_1, T_2, T_3, T_4, T_5,
  T_6,>(
  ...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2, T_3, T_4, T_5, T_6]>
): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_0, T_1, T_2, T_3, T_4, T_5,
  T_6, T_7,>(
  ...arrayLikes: MapArrayToIterables<
    [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]
  >
): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<
  T_0,
  T_1,
  T_2,
  T_3,
  T_4,
  T_5,
  T_6,
  T_7,
  T_8,
>(
  ...arrayLikes: MapArrayToIterables<
    [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]
  >
): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<
  T_0,
  T_1,
  T_2,
  T_3,
  T_4,
  T_5,
  T_6,
  T_7,
  T_8,
  T_9,
>(
  ...arrayLikes: MapArrayToIterables<
    [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]
  >
): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8 | T_9)[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes<T_same,>(
  ...arrayLikes: Iterable<T_same>[]
): T_same[];

/* @__NO_SIDE_EFFECTS__ */ export function concatArrayLikes(
  ...arrayLikes: Iterable<unknown>[]
): unknown[] {
  const arrayOfArrays: unknown[][] = mapArrayLike(unary(arrayFrom), arrayLikes);

  return arrayOfArrays.flat();
}
