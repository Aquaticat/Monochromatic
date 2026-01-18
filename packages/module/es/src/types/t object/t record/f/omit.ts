/**
 * Creates a new object with specified keys omitted.
 * Runtime implementation of TypeScript's Omit utility type.
 * @typeParam T - Source object type
 * @typeParam K - Union of keys to omit
 * @param source - Object to omit keys from
 * @param keys - Keys to exclude from the result
 * @returns New object without the specified keys
 * @example
 * ```ts
 * const config = { a: 1, b: 2, c: 3 };
 * const result = omit(config, 'a', 'c'); // { b: 2 }
 * ```
 */
export function omit<
  const T extends Record<string, unknown>,
  const K extends keyof T,
>(
  source: T,
  ...keys: K[]
): Omit<T, K> {
  const keysSet = new Set<PropertyKey>(keys,);
  return Object.fromEntries(
    Object.entries(source,).filter(
      ([key,],) => !keysSet.has(key,),
    ),
  ) as Omit<T, K>;
}
