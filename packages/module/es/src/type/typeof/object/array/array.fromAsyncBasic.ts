import {
  type Arrayful,
  isArrayful,
} from './arrayful.basic.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

/**
 * Converts an array or async iterable to an array.
 * If the input is already an array, it is returned as-is.
 * If the input is an async iterable, it is converted to an array using Array.fromAsync().
 *
 * @param params - Object containing the array or async iterable to convert and optional logger
 * @param params.iterable - The array or async iterable to convert
 * @param params.l - Optional logger for debugging
 * @returns The input as an array
 *
 * @example
 * ```ts
 * const arr = [1, 2, 3];
 * const result = await arrayFromAsyncBasic({ iterable: arr });
 * // result is [1, 2, 3] and is the same reference as arr
 *
 * const set = new Set([1, 2, 3]);
 * const result2 = await arrayFromAsyncBasic({ iterable: set });
 * // result2 is [1, 2, 3]
 *
 * const asyncIterable = {
 *   async *[Symbol.asyncIterator]() {
 *     yield 1;
 *     yield 2;
 *     yield 3;
 *   }
 * };
 * const result3 = await arrayFromAsyncBasic({ iterable: asyncIterable });
 * // result3 is [1, 2, 3]
 * ```
 */
export async function arrayFromAsyncBasic<const MyIterable extends Arrayful,>(
  { iterable, l, }: { iterable: MyIterable; } & Partial<Logged>,
): Promise<MyIterable extends Arrayful<infer T> ? T[] : unknown[]>;
export async function arrayFromAsyncBasic<const MyIterable extends unknown[],>(
  { iterable, l, }: { iterable: MyIterable; } & Partial<Logged>,
): Promise<MyIterable>;
export async function arrayFromAsyncBasic<const MyIterable extends MaybeAsyncIterable,>(
  { iterable, l, }: { iterable: MyIterable; } & Partial<Logged>,
): Promise<MyIterable extends MaybeAsyncIterable<infer T> ? T[] : unknown[]>;
export async function arrayFromAsyncBasic<
  const MyIterable extends MaybeAsyncIterable | Arrayful,
>(
  { iterable, l, }: { iterable: MyIterable; } & Partial<Logged>,
): Promise<unknown[]>;
export async function arrayFromAsyncBasic<
  const MyIterable extends MaybeAsyncIterable | Arrayful,
>(
  { iterable, l = getDefaultLogger(), }: { iterable: MyIterable; } & Partial<Logged>,
): Promise<unknown[]> {
  l.trace(arrayFromAsyncBasic.name,);
  if (isArrayful(iterable,))
    return iterable.array;
  if (Array.isArray(iterable,)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- had to
    return iterable as any;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- had to
  return (await Array.fromAsync(iterable,)) as any;
}
