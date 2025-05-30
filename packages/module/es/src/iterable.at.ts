// TODO: Seriously test the types for this.

import type {ArrayValues} from 'type-fest';
import {
  entriesIterable,
  entriesIterableAsync,
} from './iterable.entries.ts';
import type {Ints} from './iterable.type.ints.ts';
import type {IntsNegative10to10} from './iterable.type.intsTo10.ts';
import type {MaybeAsyncIterable} from './iterable.type.maybe.ts';
import type {Abs} from './numeric.type.abs.ts';
import type {Negative} from './numeric.type.negative.ts';

/** The atIterableAsync() function accepting an integer value and an iterable
 returns the item at that index,
 allowing for positive and negative integers.

 Negative integers count back from the last item in the iterable.

 Orignal method: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at}

 @remarks
 Data last.

 To conform with the specs, when index is positively out of range for AsyncIterable/Iterable,
 returns undefined instead of throwing an error.

 Correctly restricts the range of index passed into the function
 while iterable is an array and has \<= 48 elements.

 Correctly infers the specific element when iterable is an array and has \<= 22 elements.
 Falls back to a union of (all values of the array and undefined).
 */

/* @__NO_SIDE_EFFECTS__ */
export async function atIterableAsync<
  const T_iterable extends readonly any[],
  T_index extends Ints<Negative<T_iterable['length']>, T_iterable['length']>,
>(
  // We gotta accept negative numbers, too.
  // MAYBE: Consider adding a atIterableRestrictive,
  //        banning negative numbers, giving stricter types.
  //        Or maybe that should be named another way?
  //        Like bracketNotationIterableAsync?
  index: T_index,
  iterable: T_iterable,
): Promise<
  T_index extends IntsNegative10to10 ? T_iterable[T_index]
    : T_iterable[number] | undefined
> // Still possible to be one of elements, when index is between -1-Array.length and -1.
; // ArrayValues<T_iterable> | undefined
// We can't really test for positively out of range here
// because it would result in too much recursion.

/* @__NO_SIDE_EFFECTS__ */
export async function atIterableAsync<
  const T_iterable extends MaybeAsyncIterable<any>,
  const T_element extends T_iterable extends MaybeAsyncIterable<infer T_element>
    ? T_element
    : never,
  const T_index extends number,
>(
  index: T_index,
  iterable: T_iterable,
): Promise<T_element | undefined>;

/* @__NO_SIDE_EFFECTS__ */
export async function atIterableAsync<
  const T_iterable extends MaybeAsyncIterable<any>,
  const T_element extends T_iterable extends MaybeAsyncIterable<infer T_element>
    ? T_element
    : never,
  const T_index extends number,
>(
  index: T_index,
  iterable: T_iterable,
): Promise<T_element | undefined> {
  if (Array.isArray(iterable)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Safe enough.
    return iterable.at(index);
  }

  const iterableArray: T_element[] = [];
  for await (const [currentIndex, iterableElement] of entriesIterableAsync(iterable)) {
    if (currentIndex === index) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Safe enough.
      return iterableElement;
    }
    iterableArray.push(iterableElement);
  }

  return iterableArray.at(index);
}

/** {@inheritDoc atIterableAsync} */

/* @__NO_SIDE_EFFECTS__ */
export function atIterable<
  const T_iterable extends readonly unknown[],
  const T_index extends Ints<0, T_iterable['length']>,
  const T_passedIndex extends (T_index & {}) | (number & {}),
>(
  index: T_passedIndex,
  iterable: T_iterable,
): T_passedIndex extends T_index ? T_iterable[T_index] : (
  // Still possible to be one of elements, when index is between -1-Array.length and -1.
  ArrayValues<T_iterable> | undefined
  // We can't really test for positively out of range here
  // because it would result in too much recursion.
  );

/* @__NO_SIDE_EFFECTS__ */
export function atIterable<
  // T_element,
  const T_iterable extends Iterable<unknown>,
  const T_index extends number,
  const T_element extends T_iterable extends Iterable<infer T_element> ? T_element
    : never,
>(
  index: T_index,
  iterable: T_iterable,
): T_element | undefined;

/* @__NO_SIDE_EFFECTS__ */
export function atIterable<
  const T_iterable extends Iterable<unknown>,
  const T_index extends number,
  const T_element extends T_iterable extends Iterable<infer T_element> ? T_element
    : never,
>(
  index: T_index,
  iterable: T_iterable,
): T_element | undefined {
  if (Array.isArray(iterable)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Safe enough.
    return iterable.at(index);
  }

  const iterableArray: T_element[] = [];
  for (
    const [currentIndex, iterableElement] of entriesIterable(iterable) as Generator<
    [number, T_element]
  >
    ) {
    if (currentIndex === index) {
      return iterableElement;
    }
    iterableArray.push(iterableElement);
  }
  return iterableArray.at(index);
}

// TODO: Check if the use of unknown rather than any everywhere cripples type inference.

// MAYBE: Find a way to test types
