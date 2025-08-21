import type { Logged, } from '../../../custom/object/logged/logged.basic.ts';
import type {
  LimitedMappable,
  LimitedMappableSync,
} from '../../../custom/object/mappable/limitedMappable.basic.ts';
import type {
  IterableSync,
  MaybeAsyncIterable,
} from './iterable.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

export function iterableToLimitedMappable<
  const MyIterable extends MaybeAsyncIterable,
  const Returns = unknown,
  const T = MyIterable extends MaybeAsyncIterable<infer T> ? T : unknown,
>({
  iterable,
  l = getDefaultLogger(),
}: { iterable: MyIterable; } & Partial<Logged>,): MyIterable & LimitedMappable<T,
  Returns>
{
  l.trace(iterableToLimitedMappable.name,);

  const myIterable = iterable as MaybeAsyncIterable<T>;

  const limitedMappable: LimitedMappable<T, Returns> = {
    map: async function* map({ fn, l, },) {
      let index = 0;
      for await (const element of myIterable) {
        // TODO: Make this wonky transform a dedicated util.
        const stableArgs = { element, index, };
        yield await fn(l ? Object.assign(stableArgs, { l, },) : stableArgs,);
        index++;
      }
    },
  };

  return Object.assign(iterable, limitedMappable,);
}

export function iterableSyncToLimitedMappableSync<
  const MyIterable extends IterableSync,
  const Returns = unknown,
  const T = MyIterable extends IterableSync<infer T> ? T : unknown,
>({
  iterable,
  l = getDefaultLogger(),
}: { iterable: MyIterable; } & Partial<Logged>,): MyIterable & LimitedMappableSync<T,
  Returns>
{
  l.trace(iterableSyncToLimitedMappableSync.name,);

  const myIterable = iterable as Iterable<T>;

  const limitedMappableSync: LimitedMappableSync<T, Returns> = {
    map: function* map({ fn, l, },) {
      let index = 0;
      for (const element of myIterable) {
        // TODO: Make this wonky transform a dedicated util.
        const stableArgs = { element, index, };
        yield fn(l ? Object.assign(stableArgs, { l, },) : stableArgs,);
        index++;
      }
    },
  };

  return Object.assign(iterable, limitedMappableSync,);
}
