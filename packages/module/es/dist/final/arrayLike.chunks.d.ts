import { type Ints, type MaybeAsyncIterable, type Tuple } from '@monochromatic-dev/module-es/ts';
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
export declare function chunksArray<const T_array extends readonly [any, ...any[]], T_n extends Ints<1, T_array['length']>>(array: T_array, n: T_n): Generator<Tuple<T_array[number], T_n>>;
export declare function chunksArrayLike<const T_arrayLike extends Iterable<any> & {
    length: number;
}, T_n extends Ints<1, T_arrayLike['length']>>(arrayLike: T_arrayLike, n: T_n): Generator<Tuple<T_arrayLike extends Iterable<infer T_element> ? T_element : never, T_n>>;
export declare function chunksArrayLike<const T_arrayLike extends Iterable<any>, T_n extends number>(arrayLike: T_arrayLike, n: T_n): Generator<Tuple<T_arrayLike extends Iterable<infer T_element> ? T_element : never, T_n>>;
export declare function chunksArrayLikeAsync<const T_arrayLike extends MaybeAsyncIterable<any> & {
    length: number;
}, T_n extends Ints<1, T_arrayLike['length']>>(arrayLike: T_arrayLike, n: T_n): AsyncGenerator<Tuple<T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element : never, T_n>>;
export declare function chunksArrayLikeAsync<const T_arrayLike extends MaybeAsyncIterable<any>, T_n extends number>(arrayLike: T_arrayLike, n: T_n): AsyncGenerator<Tuple<T_arrayLike extends MaybeAsyncIterable<infer T_element> ? T_element : never, T_n>>;
