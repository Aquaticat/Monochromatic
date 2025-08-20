import type { Logged, } from './logged.basic';
import type { SchemaSync, } from './schema.basic';
import { getDefaultLogger, } from './string.log';

export function anyToSchemaSync<const T,>({
  input,
  l = getDefaultLogger(),
}: { input: T; } & Partial<Logged>,): SchemaSync<T, T> {
  l.trace('anyToSchemaSync',);
  return { parse(value: T,): T {
    if (!Object.is(value, input,))
      throw new TypeError('Object.is',);
    return value;
  }, };
}
