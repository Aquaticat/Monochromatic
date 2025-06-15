import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';

/**
 * Asynchronously filters an iterable or async iterable based on a predicate.
 * @param predicate - A function that returns a promisable boolean indicating whether to keep the element.
 * @param arrayLike - The iterable or async iterable to filter.
 * @returns A promise that resolves to an array containing elements that satisfy the predicate.
 * @template T_i - The type of elements in the iterable.
 */
export async function filterIterableAsync<T_i,>(
  predicate: (i: T_i) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<T_i[]> {
  const yes: T_i[] = [];

  for await (const i of arrayLike) {
    if (await predicate(i)) {
      yes.push(i);
    }
  }

  // We can't know the length of yes beforehand,
  // no need to define overloads for plain arrays and trying to return a tuple type.
  return yes;
}

/**
 * Filters an iterable based on a predicate.
 * @param predicate - A function that returns a boolean indicating whether to keep the element.
 * @param arrayLike - The iterable to filter.
 * @returns An array containing elements that satisfy the predicate.
 * @template T_i - The type of elements in the iterable.
 */
export function filterIterable<T_i,>(
  predicate: (i: T_i) => boolean,
  arrayLike: Iterable<T_i>,
): T_i[] {
  const yes: T_i[] = [];

  for (const i of arrayLike) {
    if (predicate(i)) {
      yes.push(i);
    }
  }

  return yes;
}

/**
 * Asynchronously filters an iterable or async iterable based on a predicate, yielding elements that satisfy the predicate.
 * This is a generator version of `filterIterableAsync`.
 * @param predicate - A function that returns a promisable boolean indicating whether to keep the element.
 * @param arrayLike - The iterable or async iterable to filter.
 * @returns An async generator yielding elements that satisfy the predicate.
 * @template T_i - The type of elements in the iterable.
 */
/* @__NO_SIDE_EFFECTS__ */
export async function* filterIterableAsyncGen<T_i,>(
  predicate: (i: T_i) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): AsyncGenerator<T_i, void, undefined> {
  for await (const i of arrayLike) {
    if (await predicate(i)) {
      yield i;
    }
  }
}

/**
 * Filters an iterable based on a predicate, yielding elements that satisfy the predicate.
 * This is a generator version of `filterIterable`.
 * @param predicate - A function that returns a boolean indicating whether to keep the element.
 * @param arrayLike - The iterable to filter.
 * @returns A generator yielding elements that satisfy the predicate.
 * @template T_i - The type of elements in the iterable.
 */
/* @__NO_SIDE_EFFECTS__ */
export function* filterIterableGen<T_i,>(
  predicate: (i: T_i) => boolean,
  arrayLike: Iterable<T_i>,
): Generator<T_i, void, undefined> {
  for (const i of arrayLike) {
    if (predicate(i)) {
      yield i;
    }
  }
}

/**
 * Asynchronously filters an iterable or async iterable based on a predicate, yielding elements that *don't* satisfy the predicate.
 * This is a generator version of `filterFailIterableAsync`.
 * @param predicate - A function that returns a promisable boolean indicating whether an element should be kept (those returning false will be yielded).
 * @param arrayLike - The iterable or async iterable to filter.
 * @returns An async generator yielding elements that *don't* satisfy the predicate.
 * @template T_i - The type of elements in the iterable.
 */
/* @__NO_SIDE_EFFECTS__ */
export async function* filterFailIterableAsyncGen<T_i,>(
  predicate: (i: T_i) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): AsyncGenerator<T_i, void, undefined> {
  for await (const i of arrayLike) {
    if (!(await predicate(i))) {
      yield i;
    }
  }
}

/**
 * Filters an iterable based on a predicate, yielding elements that *don't* satisfy the predicate.
 * This is a generator version of `filterFailIterable`.
 * @param predicate - A function that returns a boolean indicating whether an element should be kept (those returning false will be yielded).
 * @param arrayLike - The iterable to filter.
 * @returns A generator yielding elements that *don't* satisfy the predicate.
 * @template T_i - The type of elements in the iterable.
 */
/* @__NO_SIDE_EFFECTS__ */
export function* filterFailIterableGen<T_i,>(
  predicate: (i: T_i) => boolean,
  arrayLike: Iterable<T_i>,
): Generator<T_i, void, undefined> {
  for (const i of arrayLike) {
    if (!(predicate(i))) {
      yield i;
    }
  }
}

/**
 * Asynchronously filters an iterable or async iterable based on a predicate, returning elements that *don't* satisfy the predicate.
 * @param predicate - A function that returns a promisable boolean indicating whether an element should be kept (those returning false will be collected).
 * @param arrayLike - The iterable or async iterable to filter.
 * @returns A promise that resolves to an array containing elements that *don't* satisfy the predicate.
 * @template T_i - The type of elements in the iterable.
 */
export async function filterFailIterableAsync<T_i,>(
  predicate: (i: T_i) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<T_i[]> {
  const no: T_i[] = [];

  for await (const i of arrayLike) {
    if (!(await predicate(i))) {
      no.push(i);
    }
  }

  return no;
}

/**
 * Filters an iterable based on a predicate, returning elements that *don't* satisfy the predicate.
 * @param predicate - A function that returns a boolean indicating whether an element should be kept (those returning false will be collected).
 * @param arrayLike - The iterable to filter.
 * @returns An array containing elements that *don't* satisfy the predicate.
 * @template T_i - The type of elements in the iterable.
 */
export function filterFailIterable<T_i,>(
  predicate: (i: T_i) => boolean,
  arrayLike: Iterable<T_i>,
): T_i[] {
  const no: T_i[] = [];

  for (const i of arrayLike) {
    if (!(predicate(i))) {
      no.push(i);
    }
  }

  return no;
}
