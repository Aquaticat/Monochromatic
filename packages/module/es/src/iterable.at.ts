// TODO: Seriously test the types for this.

import type { ArrayValues, } from 'type-fest';
import {
  entriesIterable,
  entriesIterableAsync,
} from './iterable.entries.ts';
import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';
import type { Negative, } from './numeric.negative.ts';
import type { Ints, } from './numeric.type.ints.ts';
import type { IntsNegative10to10, } from './numeric.type.intsTo10.ts';

/**
 * Asynchronously retrieves element at specified index from an async iterable, supporting negative indexing.
 * This is the async equivalent of Array.prototype.at(), working with both sync and async iterables.
 * Negative integers count back from the last item in the iterable, with -1 being the last element.
 *
 * For performance optimization with arrays, uses native Array.prototype.at() when possible.
 * For other iterables, collects all elements first to enable negative indexing support.
 *
 * @param index - Zero-based index position, supports negative values for reverse indexing
 * @param iterable - Async iterable to retrieve element from
 * @returns Element at specified index, or undefined if index is out of bounds
 *
 * @remarks
 * **Data last parameter order**: Index comes first, then iterable for better currying support.
 * **Spec compliance**: Returns undefined for out-of-range indices instead of throwing errors.
 * **Type inference**: For arrays ≤ 22 elements, infers specific element types. For larger arrays,
 * falls back to union of all array values with undefined.
 * **Performance**: Uses native Array.at() for arrays, iterates once for other iterables.
 *
 * Original method: {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at}
 *
 * @example
 * ```ts
 * // Basic usage with arrays
 * const numbers = [10, 20, 30, 40];
 * const first = await atIterableAsync(0, numbers); // 10
 * const last = await atIterableAsync(-1, numbers); // 40
 * const outOfBounds = await atIterableAsync(10, numbers); // undefined
 *
 * // With async iterables
 * async function* asyncNumbers() {
 *   yield 1; yield 2; yield 3; yield 4;
 * }
 * const second = await atIterableAsync(1, asyncNumbers()); // 2
 * const lastAsync = await atIterableAsync(-1, asyncNumbers()); // 4
 *
 * // Negative indexing examples
 * const letters = ['a', 'b', 'c', 'd', 'e'];
 * const secondLast = await atIterableAsync(-2, letters); // 'd'
 * const thirdLast = await atIterableAsync(-3, letters); // 'c'
 *
 * // Out of bounds behavior
 * const small = [1, 2];
 * const tooHigh = await atIterableAsync(5, small); // undefined
 * const tooLow = await atIterableAsync(-5, small); // undefined
 *
 * // With Set (converted to array internally)
 * const uniqueNumbers = new Set([100, 200, 300]);
 * const firstUnique = await atIterableAsync(0, uniqueNumbers); // 100
 * const lastUnique = await atIterableAsync(-1, uniqueNumbers); // 300
 *
 * // Type safety with known-length tuples
 * const tuple: [string, number, boolean] = ['hello', 42, true];
 * const middle: number = await atIterableAsync(1, tuple); // 42, type is number
 * ```
 */

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
  if (Array.isArray(iterable,)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Safe enough.
    return iterable.at(index,);
  }

  const iterableArray: T_element[] = [];
  for await (const [currentIndex, iterableElement,] of entriesIterableAsync(iterable,)) {
    if (currentIndex === index) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Safe enough.
      return iterableElement;
    }
    iterableArray.push(iterableElement,);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Safe enough.
  return iterableArray.at(index,);
}

/**
 * Synchronously retrieves element at specified index from an iterable, supporting negative indexing.
 * This is a functional programming equivalent of Array.prototype.at() that works with any iterable.
 * Negative integers count back from the last item in the iterable, with -1 being the last element.
 *
 * For performance optimization with arrays, uses native Array.prototype.at() when possible.
 * For other iterables, collects all elements first to enable negative indexing support.
 *
 * @param index - Zero-based index position, supports negative values for reverse indexing
 * @param iterable - Iterable to retrieve element from
 * @returns Element at specified index, or undefined if index is out of bounds
 *
 * @remarks
 * **Data last parameter order**: Index comes first, then iterable for better currying support.
 * **Spec compliance**: Returns undefined for out-of-range indices instead of throwing errors.
 * **Type inference**: For arrays with known length, provides precise type inference for valid indices.
 * **Performance**: Uses native Array.at() for arrays, single iteration for other iterables.
 *
 * {@inheritDoc atIterableAsync}
 *
 * @example
 * ```ts
 * // Basic usage with arrays
 * const numbers = [10, 20, 30, 40];
 * const first = atIterable(0, numbers); // 10
 * const last = atIterable(-1, numbers); // 40
 * const outOfBounds = atIterable(10, numbers); // undefined
 *
 * // With other iterables
 * const letters = new Set(['a', 'b', 'c', 'd']);
 * const second = atIterable(1, letters); // 'b'
 * const lastLetter = atIterable(-1, letters); // 'd'
 *
 * // String iterable
 * const word = 'hello';
 * const firstChar = atIterable(0, word); // 'h'
 * const lastChar = atIterable(-1, word); // 'o'
 *
 * // Map entries
 * const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
 * const firstEntry = atIterable(0, map); // ['key1', 'value1']
 * const lastEntry = atIterable(-1, map); // ['key2', 'value2']
 *
 * // Negative indexing with various types
 * const mixed = [1, 'two', { three: 3 }, [4, 5]];
 * const secondLast = atIterable(-2, mixed); // { three: 3 }
 * const thirdLast = atIterable(-3, mixed); // 'two'
 *
 * // Type safety with tuples
 * const tuple: [string, number, boolean] = ['hello', 42, true];
 * const middle: number = atIterable(1, tuple); // 42, type is number
 * const end: boolean = atIterable(-1, tuple); // true, type is boolean
 * ```
 */
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

export function atIterable<
  const T_iterable extends Iterable<unknown>,
  const T_index extends number,
  const T_element extends T_iterable extends Iterable<infer T_element> ? T_element
    : never,
>(
  index: T_index,
  iterable: T_iterable,
): T_element | undefined {
  if (Array.isArray(iterable,)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Safe enough.
    return iterable.at(index,);
  }

  const iterableArray: T_element[] = [];
  for (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Necessary somehow.
    const [currentIndex, iterableElement,] of entriesIterable(iterable,) as Generator<
      [number, T_element,]
    >
  ) {
    if (currentIndex === index)
      return iterableElement;
    iterableArray.push(iterableElement,);
  }
  return iterableArray.at(index,);
}

// TODO: Check if the use of unknown rather than any everywhere cripples type inference.

// TODO: Write type testing tests.
