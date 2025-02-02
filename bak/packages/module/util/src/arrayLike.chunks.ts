import { getLogger } from '@logtape/logtape';
import {
  arrayFrom,
  arrayFromAsync,
  arrayIsEmpty,
  arrayIsNonEmpty,
  type Ints,
  isEmptyArray,
  isNonEmptyArray,
  type MaybeAsyncIterable,
  type Tuple,
} from './arrayLike.ts';

const l = getLogger(['m', 'arrayLike.chunks']);

// TODO: Remove T_element everywhere and switch to infer.

/** Split an array into chunks length of your choosing,
 generating them one by one.

 @param array - readonly array of at least 1 element

                readonly here means you can be assured
                the array won't be changed while inside this function.

 @param n - how many elements of the array to chunk out at a time

            Cannot be bigger than the length of the array itself.

 @returns `Generator<Tuple<T_array[number], T_n>>`

          where Tuple returns a new tuple
          type of length `n` filled with type of `array` elements
          while n \<= 10,
          a regular array of type of `array` elements otherwise.

 @throws RangeError:

         1.  `array` is empty
         2.  `n` is
             1.  float
             2.  negative
             3.  bigger than the length of the array itself.

 @remarks
 From {@link https://stackoverflow.com/a/55435856}
 by {@link https://stackoverflow.com/users/10328101/ikechukwu-eze}
 with CC BY-SA 4.0
*/
/* @__NO_SIDE_EFFECTS__ */ export function* chunksArray<
  const T_array extends readonly [any, ...any[]],
  T_n extends Ints<1, T_array['length']>,
>(
  array: T_array,
  n: T_n,
): Generator<Tuple<T_array[number], T_n>> {
  if (arrayIsEmpty(array)) {
    throw new RangeError(`What's to be chunked cannot be empty`);
  }

  // TODO: Implement throw when n is 0

  if (n > array.length) {
    throw new RangeError(`Initial chunk index is already out of range.`);
  }

  for (let i = 0; i < array.length; i += n) {
    yield array.slice(i, i + n) as Tuple<T_array[number], T_n>;
  }
}

/* @__NO_SIDE_EFFECTS__ */ export function chunksArrayLike<
  // An overload sig cannot be declared as a generator
  T_arrayLike extends Iterable<any> & { length: number; },
  T_n extends Ints<1, T_arrayLike['length']>,
>(arrayLike: T_arrayLike, n: T_n): Generator<
  Tuple<T_arrayLike extends Iterable<infer T_element> ? T_element : never, T_n>
>;

/* @__NO_SIDE_EFFECTS__ */ export function chunksArrayLike<
  // An overload sig cannot be declared as a generator
  T_arrayLike extends Iterable<any>,
  T_n extends number,
>(arrayLike: T_arrayLike, n: T_n): Generator<
  Tuple<T_arrayLike extends Iterable<infer T_element> ? T_element : never, T_n>
>;

/* @__NO_SIDE_EFFECTS__ */ export function* chunksArrayLike<
  // An overload sig cannot be declared as a generator
  T_arrayLike extends Iterable<any> | Iterable<any> & { length: number; },
  T_n extends T_arrayLike extends { length: number; } ? Ints<1, T_arrayLike['length']>
    : number,
>(arrayLike: T_arrayLike, n: T_n): Generator<
  Tuple<T_arrayLike extends Iterable<infer T_element> ? T_element : never, T_n>
> {
  l.debug`chunksArrayLike(arrayLike: ${arrayLike}, n: ${n})`;

  if (typeof (arrayLike as Iterable<any> & { length: number; })?.length === 'number') {
    if (isEmptyArray(arrayLike)) {
      throw new RangeError(
        `What's to be chunked: ${JSON.stringify(arrayLike)} cannot be empty`,
      );
    }
    if (n > (arrayLike as Iterable<any> & { length: number; }).length) {
      throw new RangeError(
        `Initial chunk index: ${n} is already out of range: ${
          (arrayLike as Iterable<any> & { length: number; }).length
        }`,
      );
    }

    l.debug`arrayLike.length: ${
      (arrayLike as Iterable<any> & { length: number; }).length
    }, n: ${n}`;
  }

  // TODO: Switch this to lazy.
  //       Do a check on whether it's an array. If so, yield* to chunksArray
  //       If not, iterate as normal and only take what we need.
  const arrayLikeArray:
    readonly (T_arrayLike extends Iterable<infer T_element> ? T_element : never)[] =
      arrayFrom(
        arrayLike,
      );

  l.debug`arrayLikeArray: ${arrayLikeArray}`;

  if (n > arrayLikeArray.length) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${arrayLikeArray.length}`,
    );
  }

  if (arrayIsEmpty(arrayLikeArray)) {
    throw new RangeError(
      `What's to be chunked: ${JSON.stringify(arrayLikeArray)} cannot be empty`,
    );
  }

  if (arrayIsNonEmpty(arrayLikeArray)) {
    yield* chunksArray(arrayLikeArray, n);
    return;
  }

  throw new Error(`impossible state. ${arrayLikeArray} is neither empty nor non-empty`);
}

/* @__NO_SIDE_EFFECTS__ */ export function chunksArrayLikeAsync<
  // An overload sig cannot be declared as a generator
  T_arrayLike extends MaybeAsyncIterable<any> & { length: number; },
  T_n extends Ints<1, T_arrayLike['length']>,
>(
  arrayLike: T_arrayLike,
  n: T_n,
): AsyncGenerator<
  Tuple<T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element : never, T_n>
>;

/* @__NO_SIDE_EFFECTS__ */ export function chunksArrayLikeAsync<
  // An overload sig cannot be declared as a generator
  T_arrayLike extends MaybeAsyncIterable<any>,
  T_n extends number,
>(
  arrayLike: T_arrayLike,
  n: T_n,
): AsyncGenerator<
  Tuple<T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element : never, T_n>
>;

/* @__NO_SIDE_EFFECTS__ */ export async function* chunksArrayLikeAsync<
  // An overload sig cannot be declared as a generator
  T_arrayLike extends
    | MaybeAsyncIterable<any>
    | MaybeAsyncIterable<any> & { length: number; },
  T_n extends T_arrayLike extends { length: number; } ? Ints<1, T_arrayLike['length']>
    : number,
>(arrayLike: T_arrayLike, n: T_n): AsyncGenerator<
  Tuple<T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element : never, T_n>
> {
  // TODO: Switch this to lazy.

  l.debug`chunksArrayLikeAsync(arrayLike: ${arrayLike}, n: ${n})`;

  if (
    typeof (arrayLike as MaybeAsyncIterable<any> & { length: number; })?.length
      === 'number'
  ) {
    if (isEmptyArray(arrayLike)) {
      throw new RangeError(
        `What's to be chunked: ${JSON.stringify(arrayLike)} cannot be empty`,
      );
    }
    if (n > (arrayLike as MaybeAsyncIterable<any> & { length: number; }).length) {
      throw new RangeError(
        `Initial chunk index: ${n} is already out of range: ${
          (arrayLike as MaybeAsyncIterable<any> & { length: number; }).length
        }`,
      );
    }

    l.debug`arrayLike.length: ${
      (arrayLike as MaybeAsyncIterable<any> & { length: number; }).length
    }, n: ${n}`;
  }

  const arrayLikeArray:
    readonly (T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element
      : never)[] = await arrayFromAsync(arrayLike);

  l.debug`arrayLikeArray: ${arrayLikeArray}`;

  if (n > arrayLikeArray.length) {
    throw new RangeError(
      `Initial chunk index: ${n} is already out of range: ${arrayLikeArray.length}`,
    );
  }

  if (arrayIsEmpty(arrayLikeArray)) {
    throw new RangeError(
      `What's to be chunked: ${JSON.stringify(arrayLikeArray)} cannot be empty`,
    );
  }

  if (arrayIsNonEmpty(arrayLikeArray)) {
    yield* chunksArray(arrayLikeArray, n);
    return;
  }

  throw new Error(`impossible state. ${arrayLikeArray} is neither empty nor non-empty`);
}
