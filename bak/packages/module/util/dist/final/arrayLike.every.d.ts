import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable } from './arrayLike.type.ts';
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
export declare function everyArrayLikeAsync<T_element, T_arrayLike extends MaybeAsyncIterable<T_element>>(testingFn: (element: T_element, index?: number, array?: T_element[]) => Promisable<boolean>, arrayLike: T_arrayLike): Promise<boolean>;
export declare function everyFailArrayLikeAsync<T_element, T_arrayLike extends MaybeAsyncIterable<T_element>>(testingFn: (element: T_element, index?: number, array?: T_element[]) => Promisable<boolean>, arrayLike: T_arrayLike): Promise<boolean>;
export declare function noneArrayLikeAsync<T_element, T_arrayLike extends MaybeAsyncIterable<T_element>>(testingFn: (element: T_element, index?: number, array?: T_element[]) => Promisable<boolean>, arrayLike: T_arrayLike): Promise<boolean>;
export declare function noneFailArrayLikeAsync<T_element, T_arrayLike extends MaybeAsyncIterable<T_element>>(testingFn: (element: T_element, index?: number, array?: T_element[]) => Promisable<boolean>, arrayLike: T_arrayLike): Promise<boolean>;
