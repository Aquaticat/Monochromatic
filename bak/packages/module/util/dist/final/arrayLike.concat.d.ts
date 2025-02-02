import type { MapArrayToIterables, MapArrayToMaybeAsyncIterables, MaybeAsyncIterable } from './arrayLike.type.ts';
export declare function concatArrayLikesAsync<T_0>(...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0]>): Promise<T_0[]>;
export declare function concatArrayLikesAsync<T_0, T_1>(...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1]>): Promise<(T_0 | T_1)[]>;
export declare function concatArrayLikesAsync<T_0, T_1, T_2>(...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2]>): Promise<(T_0 | T_1 | T_2)[]>;
export declare function concatArrayLikesAsync<T_0, T_1, T_2, T_3>(...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2, T_3]>): Promise<(T_0 | T_1 | T_2 | T_3)[]>;
export declare function concatArrayLikesAsync<T_0, T_1, T_2, T_3, T_4>(...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2, T_3, T_4]>): Promise<(T_0 | T_1 | T_2 | T_3 | T_4)[]>;
export declare function concatArrayLikesAsync<T_0, T_1, T_2, T_3, T_4, T_5>(...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2, T_3, T_4, T_5]>): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5)[]>;
export declare function concatArrayLikesAsync<T_0, T_1, T_2, T_3, T_4, T_5, T_6>(...arrayLikes: MapArrayToMaybeAsyncIterables<[T_0, T_1, T_2, T_3, T_4, T_5, T_6]>): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6)[]>;
export declare function concatArrayLikesAsync<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7>(...arrayLikes: MapArrayToMaybeAsyncIterables<[
    T_0,
    T_1,
    T_2,
    T_3,
    T_4,
    T_5,
    T_6,
    T_7
]>): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7)[]>;
export declare function concatArrayLikesAsync<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8>(...arrayLikes: MapArrayToMaybeAsyncIterables<[
    T_0,
    T_1,
    T_2,
    T_3,
    T_4,
    T_5,
    T_6,
    T_7,
    T_8
]>): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8)[]>;
export declare function concatArrayLikesAsync<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9>(...arrayLikes: MapArrayToMaybeAsyncIterables<[
    T_0,
    T_1,
    T_2,
    T_3,
    T_4,
    T_5,
    T_6,
    T_7,
    T_8,
    T_9
]>): Promise<(T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8 | T_9)[]>;
export declare function concatArrayLikesAsync<T_same>(...arrayLikes: MaybeAsyncIterable<T_same>[]): Promise<T_same[]>;
export declare function concatArrayLikes<T_0>(...arrayLikes: MapArrayToIterables<[T_0]>): T_0[];
export declare function concatArrayLikes<T_0, T_1>(...arrayLikes: MapArrayToIterables<[T_0, T_1]>): (T_0 | T_1)[];
export declare function concatArrayLikes<T_0, T_1, T_2>(...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2]>): (T_0 | T_1 | T_2)[];
export declare function concatArrayLikes<T_0, T_1, T_2, T_3>(...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2, T_3]>): (T_0 | T_1 | T_2 | T_3)[];
export declare function concatArrayLikes<T_0, T_1, T_2, T_3, T_4>(...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2, T_3, T_4]>): (T_0 | T_1 | T_2 | T_3 | T_4)[];
export declare function concatArrayLikes<T_0, T_1, T_2, T_3, T_4, T_5>(...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2, T_3, T_4, T_5]>): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5)[];
export declare function concatArrayLikes<T_0, T_1, T_2, T_3, T_4, T_5, T_6>(...arrayLikes: MapArrayToIterables<[T_0, T_1, T_2, T_3, T_4, T_5, T_6]>): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6)[];
export declare function concatArrayLikes<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7>(...arrayLikes: MapArrayToIterables<[
    T_0,
    T_1,
    T_2,
    T_3,
    T_4,
    T_5,
    T_6,
    T_7
]>): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7)[];
export declare function concatArrayLikes<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8>(...arrayLikes: MapArrayToIterables<[
    T_0,
    T_1,
    T_2,
    T_3,
    T_4,
    T_5,
    T_6,
    T_7,
    T_8
]>): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8)[];
export declare function concatArrayLikes<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9>(...arrayLikes: MapArrayToIterables<[
    T_0,
    T_1,
    T_2,
    T_3,
    T_4,
    T_5,
    T_6,
    T_7,
    T_8,
    T_9
]>): (T_0 | T_1 | T_2 | T_3 | T_4 | T_5 | T_6 | T_7 | T_8 | T_9)[];
export declare function concatArrayLikes<T_same>(...arrayLikes: Iterable<T_same>[]): T_same[];
