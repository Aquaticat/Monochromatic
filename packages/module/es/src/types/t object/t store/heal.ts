import type { BackendResult, } from './consensus.ts';

/**
 * Heal async backends to the canonical serialized value by deleting or setting mismatches.
 *
 * @param results - all backend results
 *
 * @param canonicalSerialized - canonical serialized value (or undefined)
 *
 * @param key - key to heal
 *
 * @example
 * ```ts
 * await healBackends(results, '"correct-value"', 'my-key');
 * ```
 */
export async function healBackends(
  results: readonly BackendResult<
    {
      set: (key: string, value: string,) => unknown;
      delete: (key: string,) => unknown
    }
  >[],
  canonicalSerialized: string | undefined,
  key: string,
): Promise<void> {
  await Promise.all(
    results.map(async function heal({
      value,
      backend,
    },) {
      if (canonicalSerialized === undefined) {
        if (value !== undefined)
          await backend.delete(key,);
        return;
      }

      if (value !== canonicalSerialized)
        await backend.set(
          key,
          canonicalSerialized,
        );
    },),
  );
}

/**
 * Heal sync backends to the canonical serialized value by deleting or setting mismatches.
 *
 * @param results - all backend results
 *
 * @param canonicalSerialized - canonical serialized value (or undefined)
 *
 * @param key - key to heal
 *
 * @example
 * ```ts
 * healBackendsSync(results, '"correct-value"', 'my-key');
 * ```
 */
export function healBackendsSync(
  results: readonly BackendResult<
    {
      set: (key: string, value: string,) => unknown;
      delete: (key: string,) => unknown
    }
  >[],
  canonicalSerialized: string | undefined,
  key: string,
): void {
  for (const {
    value,
    backend,
  } of results) {
    if (canonicalSerialized === undefined) {
      if (value !== undefined)
        backend.delete(key,);
      continue;
    }

    if (value !== canonicalSerialized)
      backend.set(
        key,
        canonicalSerialized,
      );
  }
}
