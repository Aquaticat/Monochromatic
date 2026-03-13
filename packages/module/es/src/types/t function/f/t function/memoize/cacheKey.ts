/**
 * Build the full cache key from keyFn output and resolved salt.
 *
 * @param argKey - key derived from function arguments via keyFn
 *
 * @param salt - salt value to append
 *
 * @returns composite cache key
 *
 * @example
 * ```ts
 * buildCacheKey('arg-key', 'v1'); // 'arg-key:v1'
 * ```
 */
export function buildCacheKey(argKey: string, salt: string,): string {
  return `${argKey}:${salt}`;
}
