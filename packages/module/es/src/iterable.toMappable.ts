import type { MaybeAsyncIterable, } from './iterable.type.maybe';
import type { Logged, } from './logged.basic';
import type {
  Mappable,
  Mapper,
} from './mappable.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

/**
 * Converts an iterable or async iterable to a mappable object.
 * The returned object implements the Mappable interface which provides a map method.
 *
 * @param params - Object containing the iterable to convert and optional logger
 * @param params.iterable - The iterable or async iterable to convert to mappable
 * @param params.l - Optional logger for debugging
 * @returns Object that implements the Mappable interface
 *
 * @example
 * ```ts
 * // With regular array
 * const arr = [1, 2, 3];
 * const mappableArr = iterableToMappable({ iterable: arr });
 * const doubled = await mappableArr.map({
 *   fn: ({ element }) => element * 2
 * }); // This processes the iterable and returns a mapped result
 *
 * // With async iterable
 * async function* asyncNumbers() {
 *   yield 1;
 *   yield 2;
 *   yield 3;
 * }
 * const mappableAsync = iterableToMappable({ iterable: asyncNumbers() });
 * const strings = await mappableAsync.map({
 *   fn: async ({ element }) => `Number: ${element}`
 * }); // This processes the async iterable and returns a mapped result
 * ```
 */
export function iterableToMappable<const T,>(
  { iterable, l = getDefaultLogger(), }: { iterable: MaybeAsyncIterable<T>; } & Partial<
    Logged
  >,
): Mappable<T, any> {
  l.trace(iterableToMappable.name,);

  // Create the mappable object
  return {
    // Implement the map method
    map: async function map<const Returns,>(
      { fn, l: mapLogger = getDefaultLogger(), }: { fn: Mapper<T, Returns>; } & Partial<
        Logged
      >,
    ): Promise<Returns> {
      mapLogger.trace('iterableToMappable.map',);

      // Handle async iterables
      if (isAsyncIterable(iterable,)) {
        let index = 0;
        const results: Returns[] = [];
        for await (const element of iterable) {
          const result = await fn({ element, index: index++, mappable: this,
            l: mapLogger, },);
          results.push(result,);
        }
        // Return the results array as the mapped value
        return results as unknown as Returns;
      }
      else {
        // Handle sync iterables
        let index = 0;
        const results: Returns[] = [];
        for (const element of iterable) {
          // We need to await here in case the mapper function returns a Promise
          const result = await fn({ element, index: index++, mappable: this,
            l: mapLogger, },);
          results.push(result,);
        }
        // Return the results array as the mapped value
        return results as unknown as Returns;
      }
    },
  };
}

/**
 * Type guard to check if an object is an AsyncIterable
 */
function isAsyncIterable<T,>(obj: MaybeAsyncIterable<T>,): obj is AsyncIterable<T> {
  return typeof obj === 'object' && obj !== null && Symbol.asyncIterator in obj;
}
