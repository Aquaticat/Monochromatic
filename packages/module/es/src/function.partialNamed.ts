import type { UnknownRecord, } from 'type-fest';

export function partialNamed<
  const MyFn extends (options: UnknownRecord,) => unknown = (
    options: UnknownRecord,
  ) => unknown,
  const PreApplied extends Partial<Parameters<MyFn>> = Partial<Parameters<MyFn>>,
>(
  { fn, preApplied, }: { fn: MyFn; preApplied: PreApplied; },
): Parameters<MyFn>[0] extends PreApplied ? MyFn
  : (options: Exclude<Parameters<MyFn>[0], PreApplied>,) => ReturnType<MyFn>
{
}
