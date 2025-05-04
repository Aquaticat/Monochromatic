import { type MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
export declare function someArrayLikeAsync<T_element>(predicate: (element: T_element) => Promisable<boolean>, arrayLike: MaybeAsyncIterable<T_element>): Promise<boolean>;
export declare function someFailArrayLikeAsync<T_element>(predicate: (element: T_element) => Promisable<boolean>, arrayLike: MaybeAsyncIterable<T_element>): Promise<boolean>;
