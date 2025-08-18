import { arrayFromAsyncBasic, } from './array.fromAsyncBasic.ts';
import type { Arrayful, } from './arrayful.basic.ts';
import { isAsyncIterable, } from './iterable.is.ts';
import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';
import type { Logged, } from './logged.basic.ts';
import type {
  Mappable,
  Mapper,
} from './mappable.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

/**
 * Converts an Arrayful to a Mappable object.
 * The returned object implements the Mappable interface which provides a map method.
 * Arrayful extends both Iterable and AsyncIterable, making it mappable in both sync and async contexts.
 *
 * @param params - Object containing the arrayful to convert and optional logger
 * @param params.arrayful - The Arrayful to convert to Mappable
 * @param params.l - Optional logger for debugging
 * @returns Object that implements the Mappable interface
 *
 * @example
 * ```ts
 * // With regular array
 * const arr = [1, 2, 3];
 * const mappableArr = arrayfulToMappable({ arrayful: arr });
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
 * const mappableAsync = arrayfulToMappable({ arrayful: asyncNumbers() });
 * const strings = await mappableAsync.map({
 *   fn: async ({ element }) => `Number: ${element}`
 * }); // ["Number: 1", "Number: 2", "Number: 3"]
 * ```
 */
export function arrayfulToMappable<const MyArrayful extends Arrayful,
  const Returns = unknown, const T = MyArrayful extends Arrayful<infer T> ? T : never,>(
  { arrayful, l = getDefaultLogger(), }: { arrayful: MyArrayful; } & Partial<
    Logged
  >,
): MyArrayful & Mappable<T, Returns> {
  l.trace(arrayfulToMappable.name,);

  const arrayfulArray = arrayful.array as T[];

  const mappableObj: Mappable<T, Returns> = {
    map: async function* map(
      { fn, l: mapL = l, }: { fn: Mapper<T, Returns>; } & Partial<Logged>,
    ) {
      mapL.trace(map.name,);
      for (const [index, element,] of arrayfulArray.entries())
        yield await fn({ element, index, mappable: arrayfulArray, },);
    },
  };

  // Create the mappable object
  const returns = Object.assign(arrayful, mappableObj,);

  return returns;
}
