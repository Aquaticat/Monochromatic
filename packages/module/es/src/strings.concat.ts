import {
  isIterable,
  isMaybeAsyncIterable,
} from './iterable.is.ts';
import type {MaybeAsyncIterable} from './iterable.type.maybe.ts';
import {isString} from './string.is.ts';

/**
 * Base function for synchronous string concatenation
 */
function concatStringsBaseSync(separator: string, ...strings: any[]): string {
  if (!Array.isArray(strings)) {
    throw new Error("strings isn't an iterable");
  }

  if (strings.length === 0) {
    return '';
  }

  if (strings.length === 1) {
    const strings0 = strings[0];

    if (typeof strings0 === 'string') {
      return strings0;
    }

    if (isIterable(strings0)) {
      const items = [...strings0];
      if (!items.every(isString)) {
        throw new TypeError(
          `Expected an Iterable of strings but got ${strings0}`,
        );
      }
      return items.join(separator);
    }

    throw new TypeError(`Expected a string or a Iterable of strings but got ${strings0}`);
  }

  return strings.join(separator);
}

/**
 * Base function for asynchronous string concatenation
 */
async function concatStringsBaseAsync(separator: string,
                                      ...strings: any[]): Promise<string> {
  if (!Array.isArray(strings)) {
    throw new Error("strings isn't an iterable");
  }

  if (strings.length === 0) {
    return '';
  }

  if (strings.length === 1) {
    const strings0 = strings[0];

    if (typeof strings0 === 'string') {
      return strings0;
    }

    if (isMaybeAsyncIterable(strings0)) {
      const items = await Array.fromAsync(strings0);
      if (!items.every(isString)) {
        throw new TypeError(
          `Expected an Iterable of strings but got ${strings0}`,
        );
      }
      return items.join(separator);
    }

    throw new TypeError(
      `Expected a string or a MaybeAsyncIterable of strings but got ${strings0}`,
    );
  }

  return strings.join(separator);
}

// Sync functions
export function concatStrings(strings: Iterable<string>): string;
export function concatStrings(...strings: string[]): string;
/**
 * Concats all the strings passed in as params into one string.
 * There's no separator, or we could say the separator is ''.
 */
export function concatStrings(...strings: any): string {
  return concatStringsBaseSync('', ...strings);
}

export function concatStringsWithSpace(strings: Iterable<string>): string;
export function concatStringsWithSpace(...strings: string[]): string;
/**
 * Concats all the strings passed in as params into one string with space separator.
 */
export function concatStringsWithSpace(...strings: any): string {
  return concatStringsBaseSync(' ', ...strings);
}

export function concatStringsWithNewline(strings: Iterable<string>): string;
export function concatStringsWithNewline(...strings: string[]): string;
/**
 * Concats all the strings passed in as params into one string with space separator.
 */
export function concatStringsWithNewline(...strings: any): string {
  return concatStringsBaseSync('\n', ...strings);
}

// Async functions
export function concatStringsAsync(strings: MaybeAsyncIterable<string>): Promise<string>;
export function concatStringsAsync(...strings: string[]): Promise<string>;
/**
 * Async version of concatStrings
 */
export async function concatStringsAsync(...strings: any): Promise<string> {
  return await concatStringsBaseAsync('', ...strings);
}

export function concatStringsAsyncWithSpace(
  strings: MaybeAsyncIterable<string>,
): Promise<string>;
export function concatStringsAsyncWithSpace(...strings: string[]): Promise<string>;
/**
 * Async version of concatStringsWithSpace
 */
export async function concatStringsAsyncWithSpace(...strings: any): Promise<string> {
  return await concatStringsBaseAsync(' ', ...strings);
}

export function concatStringsAsyncWithNewline(
  strings: MaybeAsyncIterable<string>,
): Promise<string>;
export function concatStringsAsyncWithNewline(...strings: string[]): Promise<string>;
/**
 * Async version of concatStringsWithNewline
 */
export async function concatStringsAsyncWithNewline(...strings: any): Promise<string> {
  return await concatStringsBaseAsync('\n', ...strings);
}
