/* TODO: Optimize performance for this function.
         We don't need to await for the current iterated element to be ready before moving on to the next iterated element. */

import type { MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';

/**
 @deprecated Naming change. Use partitionArrayLikeAsync instead.
 */
/* @__NO_SIDE_EFFECTS__ */ export async function partitionArrAsync<T_i,>(
  predicate: (i: T_i) => Promise<boolean> | boolean,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<[T_i[], T_i[]]> {
  const yes: T_i[] = [];
  const no: T_i[] = [];

  for await (const i of arrayLike) {
    if (await predicate(i)) {
      yes.push(i);
    } else {
      no.push(i);
    }
  }

  return [yes, no];
}

/* @__NO_SIDE_EFFECTS__ */ export async function partitionArrayLikeAsync<T_i,>(
  predicate: (i: T_i) => Promisable<boolean>,
  arrayLike: MaybeAsyncIterable<T_i>,
): Promise<[T_i[], T_i[]]> {
  const yes: T_i[] = [];
  const no: T_i[] = [];

  for await (const i of arrayLike) {
    if (await predicate(i)) {
      yes.push(i);
    } else {
      no.push(i);
    }
  }

  return [yes, no];
}

/* @__NO_SIDE_EFFECTS__ */ export function partitionArrayLike<T_i,>(
  predicate: (i: T_i) => boolean,
  arrayLike: Iterable<T_i>,
): [T_i[], T_i[]] {
  const yes: T_i[] = [];
  const no: T_i[] = [];

  for (const i of arrayLike) {
    if (predicate(i)) {
      yes.push(i);
    } else {
      no.push(i);
    }
  }

  return [yes, no];
}
