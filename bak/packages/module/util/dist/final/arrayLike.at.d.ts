import type { ArrayValues } from 'type-fest';
import type { Ints, IntsNegative22to22, MaybeAsyncIterable } from './arrayLike.type.ts';
import type { Abs, Negative } from './numeric.ts';
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
export declare function atArrayLikeAsync<const T_arrayLike extends readonly any[], T_index extends Ints<Negative<T_arrayLike['length']>, T_arrayLike['length']>>(index: T_index, arrayLike: T_arrayLike): Promise<T_index extends IntsNegative22to22 ? T_arrayLike[Abs<T_index>] : T_arrayLike[number] | undefined>;
export declare function atArrayLikeAsync<T_element, const T_arrayLike extends MaybeAsyncIterable<T_element>, const T_index extends number>(index: T_index, arrayLike: T_arrayLike): Promise<T_element | undefined>;
/** {@inheritDoc atArrayLikeAsync} */
export declare function atArrayLike<const T_arrayLike extends readonly unknown[], const T_index extends Ints<0, T_arrayLike['length']>, const T_passedIndex extends (T_index & {}) | (number & {})>(index: T_passedIndex, arrayLike: T_arrayLike): T_passedIndex extends T_index ? T_arrayLike[T_index] : (ArrayValues<T_arrayLike> | undefined);
export declare function atArrayLike<T_element, const T_arrayLike extends Iterable<T_element>, const T_index extends number>(index: T_index, arrayLike: T_arrayLike): T_element | undefined;
