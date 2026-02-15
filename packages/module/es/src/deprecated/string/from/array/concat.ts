import type { MaybeAsyncIterable, } from '../../../iterable.basic.ts';
import {
  isIterable,
  isMaybeAsyncIterable,
} from '../../../iterable.is.ts';
import { isString, } from './string.is.ts';

/**
 * Base function for synchronous string concatenation
 */
function concatStringsBaseSync(separator: string, ...strings: any[]): string {
  if (!Array.isArray(strings,))
    throw new Error("strings isn't an iterable",);

  if (strings.length === 0)
    return '';

  if (strings.length === 1) {
    const strings0 = strings[0];

    if (typeof strings0 === 'string')
      return strings0;

    if (isIterable(strings0,)) {
      const items = [...strings0,];
      if (!items.every(isString,)) {
        throw new TypeError(
          `Expected an Iterable of strings but got ${strings0}`,
        );
      }
      return items.join(separator,);
    }

    throw new TypeError(
      `Expected a string or a Iterable of strings but got ${strings0}`,
    );
  }

  return strings.join(separator,);
}

/**
 * Base function for asynchronous string concatenation
 */
async function concatStringsBaseAsync(separator: string,
  ...strings: any[]): Promise<string>
{
  if (!Array.isArray(strings,))
    throw new Error("strings isn't an iterable",);

  if (strings.length === 0)
    return '';

  if (strings.length === 1) {
    const strings0 = strings[0];

    if (typeof strings0 === 'string')
      return strings0;

    if (isMaybeAsyncIterable(strings0,)) {
      const items = await Array.fromAsync(strings0,);
      if (!items.every(isString,)) {
        throw new TypeError(
          `Expected an Iterable of strings but got ${strings0}`,
        );
      }
      return items.join(separator,);
    }

    throw new TypeError(
      `Expected a string or a MaybeAsyncIterable of strings but got ${strings0}`,
    );
  }

  return strings.join(separator,);
}

// Sync functions
export function concatStrings(strings: Iterable<string>,): string;
export function concatStrings(...strings: string[]): string;
/**
 * Concatenates strings or an iterable of strings into a single string without any separator.
 * Supports both variadic string arguments and a single iterable of strings for flexible usage.
 *
 * @param strings - Either multiple string arguments or a single iterable of strings to concatenate
 * @returns Single concatenated string with no separator between elements
 * @example
 * ```ts
 * // Variadic string arguments
 * const result1 = concatStrings('Hello', 'World', '!'); // "HelloWorld!"
 *
 * // Single iterable argument
 * const words = ['Hello', 'World', '!'];
 * const result2 = concatStrings(words); // "HelloWorld!"
 *
 * // Works with any iterable
 * const set = new Set(['a', 'b', 'c']);
 * const result3 = concatStrings(set); // "abc"
 *
 * // Empty cases
 * const empty1 = concatStrings(); // ""
 * const empty2 = concatStrings([]); // ""
 * ```
 */
export function concatStrings(...strings: any): string {
  return concatStringsBaseSync('', ...strings,);
}

export function concatStringsWithSpace(strings: Iterable<string>,): string;
export function concatStringsWithSpace(...strings: string[]): string;
/**
 * Concatenates strings or an iterable of strings into a single string with space separator.
 * Provides readable text output by joining elements with spaces, useful for sentence formation
 * and human-readable text generation.
 *
 * @param strings - Either multiple string arguments or a single iterable of strings to concatenate
 * @returns Single concatenated string with space separator between elements
 * @example
 * ```ts
 * // Variadic string arguments
 * const sentence1 = concatStringsWithSpace('Hello', 'beautiful', 'world'); // "Hello beautiful world"
 *
 * // Single iterable argument
 * const words = ['The', 'quick', 'brown', 'fox'];
 * const sentence2 = concatStringsWithSpace(words); // "The quick brown fox"
 *
 * // Works with any iterable
 * const set = new Set(['one', 'two', 'three']);
 * const result = concatStringsWithSpace(set); // "one two three"
 *
 * // Single word
 * const single = concatStringsWithSpace('hello'); // "hello"
 * ```
 */
export function concatStringsWithSpace(...strings: any): string {
  return concatStringsBaseSync(' ', ...strings,);
}

export function concatStringsWithNewline(strings: Iterable<string>,): string;
export function concatStringsWithNewline(...strings: string[]): string;
/**
 * Concatenates strings or an iterable of strings into a single string with newline separator.
 * Perfect for creating multi-line text, log entries, or formatted output where each element
 * should appear on its own line.
 *
 * @param strings - Either multiple string arguments or a single iterable of strings to concatenate
 * @returns Single concatenated string with newline separator between elements
 * @example
 * ```ts
 * // Variadic string arguments
 * const multiline1 = concatStringsWithNewline('Line 1', 'Line 2', 'Line 3');
 * // "Line 1\nLine 2\nLine 3"
 *
 * // Single iterable argument
 * const lines = ['First line', 'Second line', 'Third line'];
 * const multiline2 = concatStringsWithNewline(lines);
 * // "First line\nSecond line\nThird line"
 *
 * // Log entries
 * const logEntries = ['INFO: App started', 'WARN: Low memory', 'ERROR: Connection failed'];
 * const logText = concatStringsWithNewline(logEntries);
 * // "INFO: App started\nWARN: Low memory\nERROR: Connection failed"
 *
 * // Single line
 * const single = concatStringsWithNewline('Only one line'); // "Only one line"
 * ```
 */
export function concatStringsWithNewline(...strings: any): string {
  return concatStringsBaseSync('\n', ...strings,);
}

// Async functions
export function concatStringsAsync(strings: MaybeAsyncIterable<string>,): Promise<string>;
export function concatStringsAsync(...strings: string[]): Promise<string>;
/**
 * Asynchronously concatenates strings or an iterable/async iterable of strings into a single string
 * without any separator. Handles both synchronous and asynchronous iterables, making it perfect
 * for processing streams of strings or async generators.
 *
 * @param strings - Either multiple string arguments or a single iterable/async iterable of strings
 * @returns Promise resolving to single concatenated string with no separator between elements
 * @example
 * ```ts
 * // Variadic string arguments
 * const result1 = await concatStringsAsync('Hello', 'World', '!'); // "HelloWorld!"
 *
 * // Synchronous iterable
 * const words = ['Hello', 'World', '!'];
 * const result2 = await concatStringsAsync(words); // "HelloWorld!"
 *
 * // Asynchronous iterable
 * async function* asyncStrings() {
 *   yield 'Hello';
 *   yield 'World';
 *   yield '!';
 * }
 * const result3 = await concatStringsAsync(asyncStrings()); // "HelloWorld!"
 *
 * // Empty cases
 * const empty = await concatStringsAsync([]); // ""
 * ```
 */
export async function concatStringsAsync(...strings: any): Promise<string> {
  return await concatStringsBaseAsync('', ...strings,);
}

export function concatStringsAsyncWithSpace(
  strings: MaybeAsyncIterable<string>,
): Promise<string>;
export function concatStringsAsyncWithSpace(...strings: string[]): Promise<string>;
/**
 * Asynchronously concatenates strings or an iterable/async iterable of strings into a single string
 * with space separator. Perfect for building sentences from async data sources or processing
 * streaming text data that needs space-separated formatting.
 *
 * @param strings - Either multiple string arguments or a single iterable/async iterable of strings
 * @returns Promise resolving to single concatenated string with space separator between elements
 * @example
 * ```ts
 * // Variadic string arguments
 * const sentence1 = await concatStringsAsyncWithSpace('Hello', 'beautiful', 'world');
 * // "Hello beautiful world"
 *
 * // Synchronous iterable
 * const words = ['The', 'quick', 'brown', 'fox'];
 * const sentence2 = await concatStringsAsyncWithSpace(words); // "The quick brown fox"
 *
 * // Asynchronous iterable
 * async function* asyncWords() {
 *   yield 'Stream';
 *   yield 'processing';
 *   yield 'example';
 * }
 * const result = await concatStringsAsyncWithSpace(asyncWords()); // "Stream processing example"
 *
 * // Single word
 * const single = await concatStringsAsyncWithSpace('hello'); // "hello"
 * ```
 */
export async function concatStringsAsyncWithSpace(...strings: any): Promise<string> {
  return await concatStringsBaseAsync(' ', ...strings,);
}

export function concatStringsAsyncWithNewline(
  strings: MaybeAsyncIterable<string>,
): Promise<string>;
export function concatStringsAsyncWithNewline(...strings: string[]): Promise<string>;
/**
 * Asynchronously concatenates strings or an iterable/async iterable of strings into a single string
 * with newline separator. Ideal for creating multi-line output from async data sources, processing
 * streaming log entries, or formatting async text data with line breaks.
 *
 * @param strings - Either multiple string arguments or a single iterable/async iterable of strings
 * @returns Promise resolving to single concatenated string with newline separator between elements
 * @example
 * ```ts
 * // Variadic string arguments
 * const multiline1 = await concatStringsAsyncWithNewline('Line 1', 'Line 2', 'Line 3');
 * // "Line 1\nLine 2\nLine 3"
 *
 * // Synchronous iterable
 * const lines = ['First line', 'Second line', 'Third line'];
 * const multiline2 = await concatStringsAsyncWithNewline(lines);
 * // "First line\nSecond line\nThird line"
 *
 * // Asynchronous iterable - streaming log entries
 * async function* asyncLogs() {
 *   yield 'INFO: App started';
 *   yield 'WARN: Low memory';
 *   yield 'ERROR: Connection failed';
 * }
 * const logText = await concatStringsAsyncWithNewline(asyncLogs());
 * // "INFO: App started\nWARN: Low memory\nERROR: Connection failed"
 *
 * // Single line
 * const single = await concatStringsAsyncWithNewline('Only one line'); // "Only one line"
 * ```
 */
export async function concatStringsAsyncWithNewline(...strings: any): Promise<string> {
  return await concatStringsBaseAsync('\n', ...strings,);
}
