import { type MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
/**
 @remarks
 Iterate over all the elements in an iterable.
 */
export declare function noneFailArrayLikeAsync<T_element, T_arrayLike extends MaybeAsyncIterable<T_element>>(testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => Promisable<boolean>, arrayLike: T_arrayLike): Promise<boolean>;
export declare function noneFailArrayLike<T_element, T_arrayLike extends Iterable<T_element>>(testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => boolean, arrayLike: T_arrayLike): boolean;
