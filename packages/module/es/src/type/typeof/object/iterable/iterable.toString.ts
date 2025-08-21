import type { MaybeAsyncIterable, } from './iterable.basic.ts';

/**
 * Converts synchronous string iterable into compact formatted representation using Intl.ListFormat.
 *
 * Uses narrow style formatting with unit type configuration, producing seamless concatenation
 * without separators or delimiters. This approach leverages browser internationalization APIs
 * for consistent string formatting behavior across different environments.
 * Ideal for creating compact identifiers, tokens, or joined text streams.
 *
 * @param iterable - Synchronous string iterable to format into compact representation
 * @returns Compact string with all iterable elements joined without separators
 *
 * @example
 * Basic array concatenation:
 * ```ts
 * const items = ['apple', 'banana', 'cherry'];
 * const result = toStringIterable(items);
 * console.log(result); // "applebananacherry"
 * ```
 *
 * @example
 * Working with Sets for unique values:
 * ```ts
 * const uniqueColors = new Set(['red', 'green', 'blue', 'red']);
 * const colors = toStringIterable(uniqueColors);
 * console.log(colors); // "redgreenblue"
 * ```
 *
 * @example
 * Processing generator output:
 * ```ts
 * function* generatePrefixes() {
 *   yield 'pre';
 *   yield 'fix';
 *   yield 'ed';
 * }
 *
 * const word = toStringIterable(generatePrefixes());
 * console.log(word); // "prefixed"
 * ```
 *
 * @example
 * Creating compact identifiers:
 * ```ts
 * const idParts = ['user', '12345', 'temp'];
 * const identifier = toStringIterable(idParts);
 * console.log(identifier); // "user12345temp"
 *
 * // Compare with manual joining
 * const manual = idParts.join(''); // "user12345temp"
 * ```
 *
 * @example
 * Building CSS class names:
 * ```ts
 * const classModifiers = ['btn', 'primary', 'large'];
 * const className = toStringIterable(classModifiers);
 * console.log(className); // "btnprimarylarge"
 *
 * // For space-separated classes, use strings.join instead
 * ```
 *
 * @example
 * Text processing workflows:
 * ```ts
 * const wordParts = ['un', 'predict', 'able'];
 * const compound = toStringIterable(wordParts);
 * console.log(compound); // "unpredictable"
 *
 * const abbreviations = new Set(['HTTP', 'API', 'JSON']);
 * const acronym = toStringIterable(abbreviations);
 * console.log(acronym); // "HTTPAPIJSON"
 * ```
 *
 * @example
 * Performance comparison with alternatives:
 * ```ts
 * const parts = ['a', 'b', 'c', 'd', 'e'];
 *
 * // Using toStringIterable (Intl.ListFormat)
 * const result1 = toStringIterable(parts); // "abcde"
 *
 * // Using Array.join (more direct)
 * const result2 = Array.from(parts).join(''); // "abcde"
 *
 * // Both produce identical results, choose based on context
 * ```
 */
export function toStringIterable(iterable: Iterable<string>,): string {
  const formatter = new Intl.ListFormat(undefined, { style: 'narrow', type: 'unit', },);

  return formatter.format(iterable,);
}

/**
 * Converts async string iterable into compact formatted representation using Intl.ListFormat.
 *
 * Asynchronously processes string iterables (both sync and async) using narrow style formatting
 * with unit type configuration for seamless concatenation. Leverages Array.fromAsync for efficient
 * async iteration handling, then applies Intl.ListFormat for consistent output formatting.
 * Essential for processing streaming text data, async generators, and Promise-based string sources.
 *
 * @param iterable - Async or sync string iterable to format into compact representation
 * @returns Compact string with all iterable elements joined without separators
 *
 * @example
 * Basic async array processing:
 * ```ts
 * const items = ['apple', 'banana', 'cherry'];
 * const result = await toStringIterableAsync(items);
 * console.log(result); // "applebananacherry"
 * ```
 *
 * @example
 * Processing async generators:
 * ```ts
 * async function* generateWords() {
 *   const words = ['hello', 'async', 'world'];
 *   for (const word of words) {
 *     await new Promise(resolve => setTimeout(resolve, 10));
 *     yield word;
 *   }
 * }
 *
 * const greeting = await toStringIterableAsync(generateWords());
 * console.log(greeting); // "helloasyncworld"
 * ```
 *
 * @example
 * Streaming data concatenation:
 * ```ts
 * async function* fetchTextChunks() {
 *   const urls = ['/api/chunk1', '/api/chunk2', '/api/chunk3'];
 *   for (const url of urls) {
 *     const response = await fetch(url);
 *     const text = await response.text();
 *     yield text;
 *   }
 * }
 *
 * const concatenated = await toStringIterableAsync(fetchTextChunks());
 * console.log(concatenated); // Combined text from all chunks
 * ```
 *
 * @example
 * Processing Promise-based string sources:
 * ```ts
 * async function* generateTokens() {
 *   const promises = [
 *     Promise.resolve('auth'),
 *     Promise.resolve('token'),
 *     Promise.resolve('abc123')
 *   ];
 *
 *   for (const promise of promises) {
 *     yield await promise;
 *   }
 * }
 *
 * const token = await toStringIterableAsync(generateTokens());
 * console.log(token); // "authtokenabc123"
 * ```
 *
 * @example
 * Building dynamic content from async sources:
 * ```ts
 * async function* getPageSections() {
 *   const sections = ['header', 'content', 'footer'];
 *   for (const section of sections) {
 *     // Simulate async template loading
 *     await new Promise(resolve => setTimeout(resolve, 50));
 *     yield `<${section}>...</${section}>`;
 *   }
 * }
 *
 * const html = await toStringIterableAsync(getPageSections());
 * console.log(html); // "<header>...</header><content>...</content><footer>...</footer>"
 * ```
 *
 * @example
 * Working with mixed sync/async iterables:
 * ```ts
 * // Function works with both sync and async iterables
 * const syncResult = await toStringIterableAsync(['a', 'b', 'c']);
 * console.log(syncResult); // "abc"
 *
 * async function* asyncGen() {
 *   yield 'x'; yield 'y'; yield 'z';
 * }
 * const asyncResult = await toStringIterableAsync(asyncGen());
 * console.log(asyncResult); // "xyz"
 * ```
 *
 * @example
 * Error handling with async processing:
 * ```ts
 * async function* maybeFailingGenerator() {
 *   yield 'start';
 *   yield 'middle';
 *   // If this throws, the entire operation fails
 *   if (Math.random() > 0.5) throw new Error('Random failure');
 *   yield 'end';
 * }
 *
 * try {
 *   const result = await toStringIterableAsync(maybeFailingGenerator());
 *   console.log(result); // "startmiddleend" or throws
 * } catch (error) {
 *   console.error('Processing failed:', error.message);
 * }
 * ```
 */
export async function toStringIterableAsync(
  iterable: MaybeAsyncIterable<string>,
): Promise<string> {
  const formatter = new Intl.ListFormat(undefined, { style: 'narrow', type: 'unit', },);

  return formatter.format(await Array.fromAsync(iterable,),);
}
