import type { MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
export declare function filterArrayLikeAsync<T_i>(predicate: (i: T_i) => Promisable<boolean>, arrayLike: MaybeAsyncIterable<T_i>): Promise<T_i[]>;
export declare function filterArrayLike<T_i>(predicate: (i: T_i) => boolean, arrayLike: Iterable<T_i>): T_i[];
export declare function filterFailArrayLikeAsync<T_i>(predicate: (i: T_i) => Promisable<boolean>, arrayLike: MaybeAsyncIterable<T_i>): Promise<T_i[]>;
export declare function filterFailArrayLike<T_i>(predicate: (i: T_i) => boolean, arrayLike: Iterable<T_i>): T_i[];
