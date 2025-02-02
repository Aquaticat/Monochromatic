export declare function notNullishOrThrow<T>(potentiallyNullish: T): Exclude<T, null | undefined>;
export declare function notUndefinedOrThrow<T>(potentiallyUndefined: T): Exclude<T, undefined>;
export declare function notNullOrThrow<T>(potentiallyNull: T): Exclude<T, null>;
export type falsy = false | null | 0 | -0 | 0n | '';
export declare function notFalsyOrThrow<T>(potentiallyFalsy: T): Exclude<T, falsy>;
export declare function notFalseOrThrow<T>(potentiallyFalse: T): Exclude<T, false>;
