export declare const notNullishOrThrow: <T>(potentiallyNullish: T) => Exclude<T, null | undefined>;
export declare const notUndefinedOrThrow: <T>(potentiallyUndefined: T) => Exclude<T, undefined>;
export declare const notNullOrThrow: <T>(potentiallyNull: T) => Exclude<T, null>;
export type falsy = false | null | 0 | -0 | 0n | '';
export declare const notFalsyOrThrow: <T>(potentiallyFalsy: T) => Exclude<T, falsy>;
export declare const notFalseOrThrow: <T>(potentiallyFalse: T) => Exclude<T, false>;
