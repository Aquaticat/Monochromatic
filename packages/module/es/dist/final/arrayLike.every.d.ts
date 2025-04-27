import { type MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
/**
 @remarks
 Fails fast when encountering false, returning false.
 Throws errors when testingFn throws errors.

 Because of the failfast behavior,
 it cannot be used to assert the testingFn won't throw errors
 when called on every element of the entire arrayLike.
 This matches the behavior of the standard Array.prototype.every() .

 Because it uses parallel processing,
 we cannot even be sure if it would throw error or return false every time it runs.
 See noneArrayLikeAsync for a function
 that is guranteed to call testingFn on everything and throws when encountering an error.
 */
export declare function everyArrayLikeAsync<T_element, const T_arrayLike extends MaybeAsyncIterable<T_element>>(testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => Promisable<boolean>, arrayLike: T_arrayLike): Promise<boolean>;
export declare function everyArrayLike<T_element, const T_arrayLike extends Iterable<T_element>>(testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => boolean, arrayLike: T_arrayLike): boolean;
