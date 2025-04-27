import { type MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
export declare function everyFailArrayLikeAsync<T_element, const T_arrayLike extends MaybeAsyncIterable<T_element>>(testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => Promisable<boolean>, arrayLike: T_arrayLike): Promise<boolean>;
export declare function everyFailArrayLike<T_element, const T_arrayLike extends Iterable<T_element>>(testingFn: (element: T_element, index?: number, arrayLike?: T_arrayLike) => boolean, arrayLike: T_arrayLike): boolean;
