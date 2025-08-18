import type { MaybeAsyncIterable, } from './iterable.type.maybe';
import type { LimitedMappable, } from './limitedMappable.basic';
import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

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

export function iterableSyncToLimitedMappableSync
