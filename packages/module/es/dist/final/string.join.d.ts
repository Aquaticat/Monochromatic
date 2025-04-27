import type { MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
/**
 Join an iterable of strings by separator.
 */
export declare function joinStringsAsync(separator: string, strings: MaybeAsyncIterable<string>): Promise<string>;
export declare function joinStrings(separator: string, strings: Iterable<string>): string;
