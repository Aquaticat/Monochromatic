import type { MaybeAsyncIterable } from './arrayLike.ts';
/**
 Join an iterable of strings by separator.
 */
export declare function joinStringsAsync(separator: string, strings: MaybeAsyncIterable<string>): Promise<string>;
export declare function joinStrings(separator: string, strings: Iterable<string>): string;
