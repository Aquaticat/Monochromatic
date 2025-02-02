import {
  isArray,
  type MaybeAsyncIterable,
  type Tuple,
} from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';

/* @__NO_SIDE_EFFECTS__ */ export async function arrayFromAsync<T_element,
  T_mappedElement,
  T_arrayLike extends MaybeAsyncIterable<T_element> & { length: number; },>(
  arrayLike: T_arrayLike,
): Promise<
  Tuple<T_element, T_arrayLike['length']>
>;
/* @__NO_SIDE_EFFECTS__ */ export async function arrayFromAsync<T_element,
  T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  arrayLike: T_arrayLike,
): Promise<T_element[]>;
/* @__NO_SIDE_EFFECTS__ */ export async function arrayFromAsync<T_element,
  T_mappedElement,
  T_arrayLike extends MaybeAsyncIterable<T_element> & { length: number; },>(
  arrayLike: T_arrayLike,
  mapFn: (element: T_element, index?: number) => Promisable<T_mappedElement>,
): Promise<T_mappedElement[]>;
/* @__NO_SIDE_EFFECTS__ */ export async function arrayFromAsync<T_element,
  T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  arrayLike: T_arrayLike,
  mapFn: (element: T_element, index?: number) => Promisable<T_mappedElement>,
): Promise<
  (T_arrayLike extends { length: number; } ? Tuple<T_mappedElement, T_arrayLike['length']>
    : T_mappedElement[])
>;
/* @__NO_SIDE_EFFECTS__ */ export async function arrayFromAsync<T_element,
  T_mappedElement, T_arrayLike extends MaybeAsyncIterable<T_element>,>(
  arrayLike: T_arrayLike,
  mapFn?: (element: T_element, index?: number) => Promisable<T_mappedElement>,
): Promise<
  | (T_arrayLike extends { length: number; } ? Tuple<T_element, T_arrayLike['length']>
    : T_element[])
  | (T_arrayLike extends { length: number; }
    ? Tuple<T_mappedElement, T_arrayLike['length']>
    : T_mappedElement[])
> {
  const arrayLikeArray = (isArray(arrayLike) ? arrayLike : await (async (arrayLike) => {
    const newArrayLikeArray: T_element[] = [];
    for await (const element of arrayLike) {
      newArrayLikeArray.push(element);
    }
    return newArrayLikeArray;
  })(arrayLike)) as T_arrayLike extends { length: number; }
    ? Tuple<T_element, T_arrayLike['length']>
    : T_element[];

  if (!mapFn) {
    return arrayLikeArray as T_arrayLike extends { length: number; }
      ? Tuple<T_element, T_arrayLike['length']>
      : T_element[];
  }

  const promisableArray: Promisable<T_mappedElement>[] = [];
  let index = 0;
  for (const element of arrayLikeArray) {
    promisableArray.push(mapFn(element, index));
    index++;
  }

  return await Promise.all(promisableArray) as T_arrayLike extends { length: number; }
    ? Tuple<T_mappedElement, T_arrayLike['length']>
    : T_mappedElement[];
}

// TODO: Find everywhere I used array directly
//       without querying for length
//       when the only thing I need to provide better type info is length.

/* @__NO_SIDE_EFFECTS__ */ export function arrayFrom<T_element, T_mappedElement,
  const T_arrayLike extends Iterable<T_element> & { length: number; },>(
  arrayLike: T_arrayLike,
): Tuple<T_element, T_arrayLike['length']>;
/* @__NO_SIDE_EFFECTS__ */ export function arrayFrom<T_element, T_mappedElement,
  const T_arrayLike extends Iterable<T_element>,>(
  arrayLike: T_arrayLike,
): T_element[];
/* @__NO_SIDE_EFFECTS__ */ export function arrayFrom<T_element, T_mappedElement,
  const T_arrayLike extends Iterable<T_element> & { length: number; },>(
  arrayLike: T_arrayLike,
  mapFn: (element: T_element, index?: number) => T_mappedElement,
): Tuple<T_mappedElement, T_arrayLike['length']>;
/* @__NO_SIDE_EFFECTS__ */ export function arrayFrom<T_element, T_mappedElement,
  const T_arrayLike extends Iterable<T_element>,>(
  arrayLike: T_arrayLike,
  mapFn: (element: T_element, index?: number) => T_mappedElement,
): T_mappedElement[];
/* @__NO_SIDE_EFFECTS__ */ export function arrayFrom<T_element, T_mappedElement,
  const T_arrayLike extends Iterable<T_element>,>(
  arrayLike: T_arrayLike,
  mapFn?: (element: T_element, index?: number) => T_mappedElement,
):
  | (T_arrayLike extends { length: number; } ? Tuple<T_element, T_arrayLike['length']>
    : T_element[])
  | (T_arrayLike extends { length: number; }
    ? Tuple<T_mappedElement, T_arrayLike['length']>
    : T_mappedElement[])
{
  const arrayLikeArray = (isArray(arrayLike) ? arrayLike : ((arrayLike) => {
    const newArrayLikeArray: T_element[] = [];
    for (const element of arrayLike) {
      newArrayLikeArray.push(element);
    }
    return newArrayLikeArray;
  })(arrayLike)) as T_arrayLike extends { length: number; }
    ? Tuple<T_element, T_arrayLike['length']>
    : T_element[];

  if (!mapFn) {
    return arrayLikeArray as T_arrayLike extends { length: number; }
      ? Tuple<T_element, T_arrayLike['length']>
      : T_element[];
  }

  const mappedArray: T_mappedElement[] = [];
  let index = 0;
  for (const element of arrayLikeArray) {
    mappedArray.push(mapFn(element, index));
    index++;
  }

  return mappedArray as T_arrayLike extends { length: number; }
    ? Tuple<T_mappedElement, T_arrayLike['length']>
    : T_mappedElement[];
}

// TODO: When mapFn is passed in
