import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';

export async function arrayFromAsyncBasic<const MyIterable extends unknown[]>(iterable: MyIterable): Promise<MyIterable>;
export async function arrayFromAsyncBasic<const MyIterable extends MaybeAsyncIterable<unknown>>(iterable: MyIterable): Promise<MyIterable extends MaybeAsyncIterable<infer T> ? T[] : unknown[]>;
export async function arrayFromAsyncBasic<
  const MyIterable extends MaybeAsyncIterable<unknown>,
>(
  iterable: MyIterable,
): Promise<unknown[]> {
  if (Array.isArray(iterable,)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- had to
    return iterable as any;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- had to
  return (await Array.fromAsync(iterable,)) as any;
}
