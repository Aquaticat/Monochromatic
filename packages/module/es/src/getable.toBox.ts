import type { Box, } from './box.basic.ts';
import { notUndefinedOrThrow } from './error.throw.ts';
import type { Getable, GetableSync, } from './getable.basic.ts';
import type { Logged, } from './logged.basic.ts';
import { getDefaultLogger, } from './string.log.ts';

/**
 * Converts a Getable to a Box by retrieving its value for a specific key.
 *
 * @typeParam K - Type of key used to retrieve the value
 * @typeParam V - Type of value to be retrieved and boxed
 * @param getable - The Getable object to convert
 * @param key - The key to retrieve the value for
 * @param l - Optional logger for tracing the operation
 * @returns A Promise that resolves to a Box containing the retrieved value
 * @throws If the retrieved value is undefined
 *
 * @example
 * ```ts
 * const cache: Getable<string, number> = {
 *   get: async ({ key }) => key === 'answer' ? 42 : undefined
 * };
 *
 * const boxedValue = await getableToBox({ getable: cache, key: 'answer' });
 * // boxedValue is now { value: 42 }
 * ```
 */
export async function getableToBox<const K = unknown, const V = unknown,>(
  { getable, key, l = getDefaultLogger(), }: { getable: Getable<K, V>; key: K; }
    & Partial<Logged>,
): Promise<Box<V>> {
  l.trace('getableToBox');
  const value = notUndefinedOrThrow(await getable.get({ key, l, },));
  return { ...getable, value, };
}

/**
 * Converts a GetableSync to a Box by retrieving its value for a specific key.
 *
 * @typeParam K - Type of key used to retrieve the value
 * @typeParam V - Type of value to be retrieved and boxed
 * @param getable - The GetableSync object to convert
 * @param key - The key to retrieve the value for
 * @param l - Optional logger for tracing the operation
 * @returns A Box containing the retrieved value
 * @throws If the retrieved value is undefined
 *
 * @example
 * ```ts
 * const cache: GetableSync<string, number> = {
 *   get: ({ key }) => key === 'answer' ? 42 : undefined
 * };
 *
 * const boxedValue = getableSyncToBox({ getable: cache, key: 'answer' });
 * // boxedValue is now { value: 42 }
 * ```
 */
export function getableSyncToBox<const K = unknown, const V = unknown,>(
  { getable, key, l = getDefaultLogger(), }: { getable: GetableSync<K, V>; key: K; }
    & Partial<Logged>,
): Box<V> {
  l.trace('getableSyncToBox');
  const value = notUndefinedOrThrow(getable.get({ key, l, }));
  return { ...getable, value, };
}
