import type { Box, } from './box.basic.ts';
import { notUndefinedOrThrow } from './error.throw.ts';
import type { Getable, } from './getable.basic.ts';
import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log';

export async function getableToBox<const K = unknown, const V = unknown,>(
  { getable, key, l = getDefaultLogger(), }: { getable: Getable<K, V>; key: K; }
    & Partial<Logged>,
): Promise<Box<V>> {
  l.trace('getableToBox');
  const value = notUndefinedOrThrow(await getable.get({ key, l, },));
  return { ...getable, value, };
}
