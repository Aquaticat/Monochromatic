import type { Arrayful, } from '../../../custom/object/arrayful/arrayful.basic';
import type { Logged, } from '../../../custom/object/logged/logged.basic';
import { arrayFromAsyncBasic, } from './array.fromAsyncBasic';
import type { MaybeAsyncIterable, } from './iterable.basic';
import { getDefaultLogger, } from './string.log';

export async function iterableToArrayful<
  const MyIterable extends MaybeAsyncIterable | Arrayful,
>({ iterable, l = getDefaultLogger(), }: {
  iterable: MyIterable;
} & Partial<Logged>,): Promise<MyIterable & Arrayful<
  MyIterable extends MaybeAsyncIterable<infer T> | Arrayful<infer T> ? T : unknown
>> {
  l.trace(iterableToArrayful.name,);
  const arrayful = { array: await arrayFromAsyncBasic({ iterable, l, },), };
  const result = Object.assign(iterable, arrayful,);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- had to
  return result as any;
}
