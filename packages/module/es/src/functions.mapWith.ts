import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

export function functionsMapWith<const Args extends unknown[] = unknown[],
  const Return = unknown,>(
  { fns, args, l = getDefaultLogger(), }: { fns: ((...args: Args) => Return)[];
    args: Args; } & Partial<Logged>,
): Return[] {
  l.debug(mapWith.name,);
  return fns.map(function call(fn,) {
    l.debug(call.name,);
    return fn(...args,);
  },);
}
