/**
 * Backend querying and default-backend configuration for async stores.
 */

import type { BackendResult, } from '../../../../consensus.ts';
import type { StorageBackend, } from '../../../../t/r a/index.ts';

/**
 * Query all backends for a key and return typed results with priority info.
 *
 * @param backends - storage backends to query
 *
 * @param key - lookup key
 *
 * @returns results from all backends
 *
 * @example
 * ```ts
 * const results = await queryAllBackends(backends, 'my-key');
 * ```
 */
export async function queryAllBackends(
  backends: readonly [StorageBackend, ...StorageBackend[],],
  key: string,
): Promise<[BackendResult<StorageBackend>, ...BackendResult<StorageBackend>[],]> {
  const results = await Promise.all(
    backends.map(async function queryBackend(backend,) {
      const raw = await backend.get(key,);
      return {
        value: raw === null ? undefined : raw,
        priority: backend.priority ?? 0,
        backend,
      };
    },),
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- non-empty backends guarantees non-empty results
  return results as [BackendResult<StorageBackend>, ...BackendResult<StorageBackend>[],];
}

/**
 * Builder function that produces platform-specific default backends.
 *
 * @example
 * ```ts
 * const builder: DefaultBackendsBuilder = async ({ storeId }) => {
 *   const fileBackend = await createFileBackend(storeId);
 *   return [new Map<string, string>(), fileBackend];
 * };
 * ```
 */
export type DefaultBackendsBuilder = (args: {
  storeId: string;
},) => Promise<readonly [StorageBackend, ...StorageBackend[],]>;

/** Module-level builder set by platform entry files. */
// Intentional let: configured once at module load by platform entry
// oxlint-disable-next-line prefer-const -- Intentional: configured once at module load by platform entry
let defaultBackendsBuilder: DefaultBackendsBuilder | undefined = undefined;

/**
 * Configure a platform-specific default backends builder.
 * Call from a platform entry file at module load time.
 *
 * @param builder - function that creates backends for the current platform
 *
 * @example
 * ```ts
 * configureDefaultBackendsBuilder(async ({ storeId }) => {
 *   return [new Map<string, string>(), await createFileBackend(storeId)];
 * });
 * ```
 */
export function configureDefaultBackendsBuilder(builder: DefaultBackendsBuilder,): void {
  defaultBackendsBuilder = builder;
}

/**
 * Returns the currently configured default backends builder, if any.
 *
 * @returns builder function or undefined when no platform builder has been registered
 */
export function getDefaultBackendsBuilder(): DefaultBackendsBuilder | undefined {
  return defaultBackendsBuilder;
}

/**
 * Touch the LRU set for a key and evict the displaced entry from all backends.
 *
 * No-op when `lru` is undefined (store has no eviction policy).
 *
 * @param lru - LRU key set or undefined
 *
 * @param key - key that was just accessed
 *
 * @param backends - storage backends to evict from
 *
 * @param logger - logger for debug output
 */
export async function evictLruEntry(
  { lru, key, backends, logger, }: {
    lru: { touch(key: string,): string | undefined; } | undefined;
    key: string;
    backends: readonly [StorageBackend, ...StorageBackend[],];
    logger: { debug(msg: string,): void; };
  },
): Promise<void> {
  if (lru === undefined)
    return;
  const evicted = lru.touch(key,);
  if (evicted === undefined)
    return;
  logger.debug(`Store.evict: "${evicted}"`,);
  await Promise.all(
    backends.map(async function evictFromBackend(backend,) {
      await backend.delete(evicted,);
    },),
  );
}
