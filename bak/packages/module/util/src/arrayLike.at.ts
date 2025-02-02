// TODO: Seriously test the types for this.

import type { ArrayValues } from 'type-fest';
import {
  entriesArrayLike,
  entriesArrayLikeAsync,
} from './arrayLike.entries.ts';
import type {
  Ints,
  IntsNegative22to22,
  MaybeAsyncIterable,
} from './arrayLike.type.ts';
import type {
  Abs,
  Negative,
} from './numeric.ts';

/** The atArrayLikeAsync() function accepting an integer value and an arrayLike
 returns the item at that index,
 allowing for positive and negative integers.

 Negative integers count back from the last item in the array.

 Orignal method: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at}

 @remarks
 Data last.

 To conform with the specs, when index is positively out of range for AsyncArrayLike/ArrayLike,
 returns undefined instead of throwing an error.

 Correctly restricts the range of index passed into the function
 while arrayLike is an array and has \<= 48 elements.

 Correctly infers the specific element when arrayLike is an array and has \<= 22 elements.
 Falls back to a union of (all values of the array and undefined).
 */
/* @__NO_SIDE_EFFECTS__ */ export async function atArrayLikeAsync<
  const T_arrayLike extends readonly any[],
  T_index extends Ints<Negative<T_arrayLike['length']>, T_arrayLike['length']>,
>(
  // We gotta accept negative numbers, too.
  // MAYBE: Consider adding a atArrayLikeRestrictive,
  //        banning negative numbers, giving stricter types.
  //        Or maybe that should be named another way?
  //        Like bracketNotationArrayLikeAsync?
  index: T_index,
  arrayLike: T_arrayLike,
): Promise<
  // -22 to 22 is maximum stack depth TypeScript can handle.
  // T_index extends Ints<-22, 22> ? T_arrayLike[Abs<T_index>]
  T_index extends IntsNegative22to22 ? T_arrayLike[Abs<T_index>]
    : T_arrayLike[number] | undefined
> // Still possible to be one of elements, when index is between -1-Array.length and -1.
; // ArrayValues<T_arrayLike> | undefined
// We can't really test for positively out of range here
// because it would result in too much recursion.
// TODO: Now we have our own non-recursive Ints<A, B>, use that.

/* @__NO_SIDE_EFFECTS__ */ export async function atArrayLikeAsync<
  T_element,
  const T_arrayLike extends MaybeAsyncIterable<T_element>,
  const T_index extends number,
>(
  index: T_index,
  arrayLike: T_arrayLike,
): Promise<T_element | undefined>;

/* @__NO_SIDE_EFFECTS__ */ export async function atArrayLikeAsync<
  T_element,
  const T_arrayLike extends MaybeAsyncIterable<T_element>,
  const T_index extends number,
>(
  index: T_index,
  arrayLike: T_arrayLike,
): Promise<T_element | undefined> {
  if (Array.isArray(arrayLike)) {
    return arrayLike.at(index);
  }

  const arrayLikeArray: T_element[] = [];
  for await (const [currentIndex, arrayLikeElement] of entriesArrayLikeAsync(arrayLike)) {
    if (currentIndex === index) {
      return arrayLikeElement;
    }
    arrayLikeArray.push(arrayLikeElement);
  }
  return arrayLikeArray.at(index);
}

/** {@inheritDoc atArrayLikeAsync} */
/* @__NO_SIDE_EFFECTS__ */ export function atArrayLike<
  const T_arrayLike extends readonly unknown[],
  const T_index extends Ints<0, T_arrayLike['length']>,
  const T_passedIndex extends (T_index & {}) | (number & {}),
>(
  index: T_passedIndex,
  arrayLike: T_arrayLike,
): T_passedIndex extends T_index ? T_arrayLike[T_index] : (
  // Still possible to be one of elements, when index is between -1-Array.length and -1.
  ArrayValues<T_arrayLike> | undefined
  // We can't really test for positively out of range here
  // because it would result in too much recursion.
);

/* @__NO_SIDE_EFFECTS__ */ export function atArrayLike<
  T_element,
  const T_arrayLike extends Iterable<T_element>,
  const T_index extends number,
>(
  index: T_index,
  arrayLike: T_arrayLike,
): T_element | undefined;

/* @__NO_SIDE_EFFECTS__ */ export function atArrayLike<
  T_element,
  const T_arrayLike extends Iterable<T_element>,
  const T_index extends number,
>(
  index: T_index,
  arrayLike: T_arrayLike,
): T_element | undefined {
  if (Array.isArray(arrayLike)) {
    return arrayLike.at(index);
  }

  const arrayLikeArray: T_element[] = [];
  for (const [currentIndex, arrayLikeElement] of entriesArrayLike(arrayLike)) {
    if (currentIndex === index) {
      return arrayLikeElement;
    }
    arrayLikeArray.push(arrayLikeElement);
  }
  return arrayLikeArray.at(index);
}

// TODO: Check if the use of unknown rather than any everywhere cripples type inference.

// MAYBE: Find a way to test types
