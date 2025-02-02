import type { Promisable } from 'type-fest';
import type { MaybeAsyncIterable } from './arrayLike.ts';
import type { NotPromise } from './promise.ts';

/* @__NO_SIDE_EFFECTS__ */ export async function filterArrayLikeAsync<T_i,>(
  predicate: (i: T_i) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<T_i[]> {
  const yes: T_i[] = [];

  for await (const i of arrayLike) {
    if (await predicate(i)) {
      yes.push(i);
    }
  }

  // We cannot know the length of yes beforehand,
  // no need to define overloads for plain arrays and trying to return a tuple type.
  return yes;
}

/* @__NO_SIDE_EFFECTS__ */ export function filterArrayLike<T_i,>(
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

/* @__NO_SIDE_EFFECTS__ */ export async function filterFailArrayLikeAsync<T_i,>(
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

/* @__NO_SIDE_EFFECTS__ */ export function filterFailArrayLike<T_i,>(
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
