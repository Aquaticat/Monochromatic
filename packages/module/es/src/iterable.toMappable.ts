import { arrayFromAsyncBasic } from './array.fromAsyncBasic.ts';
import type { Arrayful } from './arrayful.basic.ts';
import { isAsyncIterable, } from './iterable.is.ts';
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
 * }); // [2, 4, 6]
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
 * }); // ["Number: 1", "Number: 2", "Number: 3"]
 * ```
 */
export function iterableToMappable<const T, const Returns = unknown>(
  { iterable, l = getDefaultLogger(), }: { iterable: MaybeAsyncIterable<T>; } & Partial<
    Logged
  >,
): MaybeAsyncIterable<T> & Mappable<T, Returns> {
  l.trace(iterableToMappable.name,);

  const arrayfulObj: Arrayful<T> = {array: await arrayFromAsyncBasic({iterable, l})};

  const mappableObj: Mappable = {
    map: function * map({fn, l: mapL = l}){
      mapL.trace(map.name);
      for (const [index, element] of arrayfulObj.array.entries()) {
        yield fn({element, index, array: arrayfulObj.array});
      }
    }
  }

  // Create the mappable object
  const returns = Object.assign() {
    // Implement the map method with the correct signature
    map: function map(
      { fn, l: mapLogger = getDefaultLogger(), }: { fn: Mapper<T, T[]>; } & Partial<
        Logged
      >,
    ) {
      mapLogger.trace('iterableToMappable.map',);

      // Process the iterable based on whether it's async or sync
      return isAsyncIterable(iterable,)
        ? // For async iterables, return a Promise
        (async () => {
          let index = 0;
          const results: T[] = [];
          for await (const element of iterable) {
            // Cast to any to avoid type issues with the mapper function
            const result = await fn({ element, index: index++, mappable: this,
              l: mapLogger, },) as any;
            results.push(result,);
          }
          return results;
        })()
        : // For sync iterables, process synchronously but still return Promise for consistency
        (async () => {
          let index = 0;
          const results: T[] = [];
          for (const element of iterable) {
            // We need to await here in case the mapper function returns a Promise
            const result = await fn({ element, index: index++, mappable: this,
              l: mapLogger, },) as any;
            results.push(result,);
          }
          return results;
        })();
    },
  };
}
