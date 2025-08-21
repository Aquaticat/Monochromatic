import type {
  ToArrayable,
  ToArrayableSync,
} from '../basic.ts';
import {
  type Arrayful,
  isArrayful,
} from './arrayful.basic.ts';
import { createArrayful, } from './arrayful.create.ts';
import type {
  IterableSync,
  MaybeAsyncIterable,
} from './iterable.basic.ts';
import {
  isIterableSync,
  isMaybeAsyncIterable,
} from './iterable.is.ts';
import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

/**
 * Converts a ToArrayable to Arrayful format.
 * @param toArrayable - Value to convert to arrayful
 * @param l - Logger instance
 * @returns Arrayful version of the input
 */
export async function toArrayableToArrayful<
  const MyToArrayable extends ToArrayable = ToArrayable,
>(
  { toArrayable, l = getDefaultLogger(), }: { toArrayable: MyToArrayable; } & Partial<
    Logged
  >,
): Promise<
  MyToArrayable extends (infer ArrayElement)[] ? MyToArrayable & Arrayful<ArrayElement>
    : MyToArrayable extends Arrayful<infer ArrayfulElement>
      ? MyToArrayable & Arrayful<ArrayfulElement>
    : MyToArrayable extends MaybeAsyncIterable<infer MaybeAsyncIterableElement>
      ? MyToArrayable & Arrayful<MaybeAsyncIterableElement>
    : never
> {
  l.debug(toArrayableToArrayful.name,);

  const potentiallyArrayfulToArrayable = toArrayable as MyToArrayable extends
    Arrayful<infer ArrayfulElement> ? MyToArrayable & Arrayful<ArrayfulElement> : never;

  if (isArrayful(potentiallyArrayfulToArrayable,))
    return potentiallyArrayfulToArrayable as any;

  if (Array.isArray(toArrayable,))
    return createArrayful({ array: toArrayable, obj: toArrayable, },) as any;

  const potentiallyMaybeAsyncIterableToArrayable = toArrayable as MyToArrayable extends
    MaybeAsyncIterable<infer MaybeAsyncIterableElement>
    ? MyToArrayable & MaybeAsyncIterable<MaybeAsyncIterableElement>
    : never;

  if (isMaybeAsyncIterable(potentiallyMaybeAsyncIterableToArrayable,)) {
    const array = await Array.fromAsync(potentiallyMaybeAsyncIterableToArrayable,);
    return createArrayful({ array,
      obj: potentiallyMaybeAsyncIterableToArrayable, },) as any;
  }

  throw new TypeError(`${JSON.stringify(toArrayable,)} isn't ToArrayable`,);
}

/**
 * Converts a ToArrayableSync to Arrayful format synchronously.
 * @param toArrayable - Value to convert to arrayful
 * @param l - Logger instance
 * @returns Arrayful version of the input
 */
export function toArrayableSyncToArrayful<
  const MyToArrayable extends ToArrayableSync = ToArrayableSync,
>(
  { toArrayable, l = getDefaultLogger(), }: { toArrayable: MyToArrayable; } & Partial<
    Logged
  >,
): MyToArrayable extends (infer ArrayElement)[] ? MyToArrayable & Arrayful<ArrayElement>
  : MyToArrayable extends Arrayful<infer ArrayfulElement>
    ? MyToArrayable & Arrayful<ArrayfulElement>
  : MyToArrayable extends IterableSync<infer IterableSyncElement>
    ? MyToArrayable & Arrayful<IterableSyncElement>
  : never
{
  l.debug(toArrayableSyncToArrayful.name,);

  const potentiallyArrayfulToArrayable = toArrayable as MyToArrayable extends
    Arrayful<infer ArrayfulElement> ? MyToArrayable & Arrayful<ArrayfulElement> : never;

  if (isArrayful(potentiallyArrayfulToArrayable,))
    return potentiallyArrayfulToArrayable as any;

  if (Array.isArray(toArrayable,))
    return createArrayful({ array: toArrayable, obj: toArrayable, },) as any;

  const potentiallyIterableSyncToArrayable = toArrayable as MyToArrayable extends
    IterableSync<infer IterableSyncElement>
    ? MyToArrayable & IterableSync<IterableSyncElement>
    : never;

  if (isIterableSync(potentiallyIterableSyncToArrayable,)) {
    const array = Array.from(potentiallyIterableSyncToArrayable,);
    return createArrayful({ array, obj: potentiallyIterableSyncToArrayable, },) as any;
  }

  throw new TypeError(`${JSON.stringify(toArrayable,)} isn't ToArrayable`,);
}
