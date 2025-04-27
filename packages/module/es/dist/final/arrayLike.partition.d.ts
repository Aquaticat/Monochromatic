import type { MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
/**
 @deprecated Naming change. Use partitionArrayLikeAsync instead.
 */
export declare function partitionArrAsync<T_i>(predicate: (i: T_i) => Promise<boolean> | boolean, arrayLike: MaybeAsyncIterable<T_i>): Promise<[T_i[], T_i[]]>;
export declare function partitionArrayLikeAsync<T_i>(predicate: (i: T_i) => Promisable<boolean>, arrayLike: MaybeAsyncIterable<T_i>): Promise<[T_i[], T_i[]]>;
export declare function partitionArrayLike<T_i>(predicate: (i: T_i) => boolean, arrayLike: Iterable<T_i>): [T_i[], T_i[]];
