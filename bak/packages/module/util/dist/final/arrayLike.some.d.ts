import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable } from './arrayLike.type.ts';
export declare function someArrayLikeAsync<T_element>(predicate: (element: T_element) => Promisable<boolean>, arrayLike: MaybeAsyncIterable<T_element>): Promise<boolean>;
export declare function someFailArrayLikeAsync<T_element>(predicate: (element: T_element) => Promisable<boolean>, arrayLike: MaybeAsyncIterable<T_element>): Promise<boolean>;
