import type { UnknownRecord } from 'type-fest';
export declare const isArray: typeof Array.isArray;
/**
 Tests if something is an Iterable and not an AsyncIterable.
 @param value the thing you want to check
 @returns boolean
 */
export declare function isIterable(value: any): value is Iterable<any>;
export declare function isAsyncIterable(value: any): value is AsyncIterable<any>;
export declare function isMaybeAsyncIterable(value: any): value is Iterable<any> | AsyncIterable<any>;
export declare function isMap(value: any): value is Map<any, any>;
export declare function isWeakMap(value: any): value is WeakMap<any, any>;
export declare function isSet(value: any): value is Set<any>;
export declare function isWeakSet(value: any): value is WeakSet<any>;
export declare function isObject(value: any): value is UnknownRecord;
export declare function isAsyncGenerator(value: any): value is AsyncGenerator;
export declare function isGenerator(value: any): value is Generator;
export declare function isEmptyArray(value: any): value is never[];
export declare function arrayIsEmpty(value: readonly any[]): value is never[];
export declare function isNonEmptyArray<T_value>(value: T_value | unknown): value is [
    T_value extends (infer Element)[] ? Element : never,
    ...(T_value extends (infer Element)[] ? Element : never)[]
];
export declare function arrayIsNonEmpty<T_value extends readonly any[]>(value: T_value | unknown): value is [
    T_value extends (infer Element)[] ? Element : never,
    ...(T_value extends (infer Element)[] ? Element : never)[]
];
