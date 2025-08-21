import type {
  ToArrayable,
  ToArrayableSync,
} from '../basic.ts';
import {
  type Arrayful,
  isArrayful,
} from './arrayful.basic.ts';
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

export async function toArrayableToArray<
  const MyToArrayable extends ToArrayable = ToArrayable,
>(
  { toArrayable, l = getDefaultLogger(), }: { toArrayable: MyToArrayable; } & Partial<
    Logged
  >,
): Promise<
  MyToArrayable extends (infer ArrayElement)[] ? MyToArrayable & ArrayElement[]
    : MyToArrayable extends Arrayful<infer ArrayfulElement>
      ? (MyToArrayable['array'] & ArrayfulElement[])
    : MyToArrayable extends MaybeAsyncIterable<infer MaybeAsyncIterableElement>
      ? MaybeAsyncIterableElement[]
    : never
> {
  l.debug(toArrayableToArray.name,);

  if (Array.isArray(toArrayable,))
    return toArrayable as any;

  const potentiallyArrayfulToArrayable = toArrayable as MyToArrayable extends
    Arrayful<infer ArrayfulElement> ? MyToArrayable & Arrayful<ArrayfulElement> : never;

  if (isArrayful(potentiallyArrayfulToArrayable,))
    return potentiallyArrayfulToArrayable.array as any;

  const potentiallyMaybeAsyncIterableToArrayable = toArrayable as MyToArrayable extends
    MaybeAsyncIterable<infer MaybeAsyncIterableElement>
    ? MyToArrayable & MaybeAsyncIterable<MaybeAsyncIterableElement>
    : never;

  if (isMaybeAsyncIterable(potentiallyMaybeAsyncIterableToArrayable,))
    return await Array.fromAsync(potentiallyMaybeAsyncIterableToArrayable,) as any;

  throw new TypeError(`${JSON.stringify(toArrayable,)} isn't ToArrayable`,);
}
export function toArrayableSyncToArray<
  const MyToArrayable extends ToArrayableSync = ToArrayableSync,
>(
  { toArrayable, l = getDefaultLogger(), }: { toArrayable: MyToArrayable; } & Partial<
    Logged
  >,
): MyToArrayable extends (infer ArrayElement)[] ? MyToArrayable & ArrayElement[]
  : MyToArrayable extends Arrayful<infer ArrayfulElement>
    ? (MyToArrayable['array'] & ArrayfulElement[])
  : MyToArrayable extends IterableSync<infer IterableSyncElement> ? IterableSyncElement[]
  : never
{
  l.debug(toArrayableSyncToArray.name,);

  if (Array.isArray(toArrayable,))
    return toArrayable as any;

  const potentiallyArrayfulToArrayable = toArrayable as MyToArrayable extends
    Arrayful<infer ArrayfulElement> ? MyToArrayable & Arrayful<ArrayfulElement> : never;

  if (isArrayful(potentiallyArrayfulToArrayable,))
    return potentiallyArrayfulToArrayable.array as any;

  const potentiallyIterableSyncToArrayable = toArrayable as MyToArrayable extends
    IterableSync<infer IterableSyncElement>
    ? MyToArrayable & IterableSync<IterableSyncElement>
    : never;

  if (isIterableSync(potentiallyIterableSyncToArrayable,))
    return Array.from(potentiallyIterableSyncToArrayable,) as any;

  throw new TypeError(`${JSON.stringify(toArrayable,)} isn't ToArrayable`,);
}
