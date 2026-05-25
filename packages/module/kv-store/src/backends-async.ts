/**
 * Backend querying and default-backend configuration for async stores.
 * Internal helpers; not part of the package public API except
 * {@link configureDefaultBackendsBuilder} and {@link DefaultBackendsBuilder},
 * which are re-exported from the package root.
 */

import type { BackendResult, } from './consensus.ts';
import type { LruKeySet, } from './lru-key-set.ts';
import type { StorageBackend, } from './types.ts';

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
 * const results = await queryAllBackends({ backends, key: 'my-key' });
 * ```
 */
export async function queryAllBackends({
  backends,
  key,
}: Readonly<{
  backends: readonly [
    StorageBackend,
    ...StorageBackend[],
  ];
  key: string;
}>,): Promise<[
  BackendResult<StorageBackend>,
  ...BackendResult<StorageBackend>[],
]> {
  /** Per-backend query results gathered concurrently. */
  const results = await Promise.all(
    backends.map(async function queryBackend(backend,) {
      /** Raw value returned by this backend before nullish normalisation. */
      const raw = await backend.get(key,);
      return {
        value: raw ?? null,
        priority: backend.priority
          ?? 0,
        backend,
      };
    },),
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- non-empty backends guarantees non-empty results
  return results as [
    BackendResult<StorageBackend>,
    ...BackendResult<StorageBackend>[],
  ];
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
export type DefaultBackendsBuilder = (args: Readonly<{
  storeId: string;
}>,) => Promise<readonly [
  StorageBackend,
  ...StorageBackend[],
]>;

/** Module-level builder registry keyed by a sentinel; one entry max, configured once at module load by platform entry. */
const builderRegistry = new Map<'default', DefaultBackendsBuilder>();

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
  builderRegistry.set(
    'default',
    builder,
  );
}

/**
 * Returns the currently configured default backends builder, if any.
 *
 * @returns builder function, or `null` when no platform builder has been registered
 *
 * @example
 * ```ts
 * const builder = getDefaultBackendsBuilder();
 * if (builder !== null) {
 *   const backends = await builder({ storeId: 'my-store' });
 * }
 * ```
 */
export function getDefaultBackendsBuilder(): DefaultBackendsBuilder | null {
  return builderRegistry.get('default',)
    ?? null;
}

/**
 * Touch the LRU set for a key and evict the displaced entry from all backends.
 *
 * No-op when `lru` is `null` (store has no eviction policy).
 *
 * @param lru - LRU key set, or `null` when no eviction policy is configured
 *
 * @param key - key that was just accessed
 *
 * @param backends - storage backends to evict from
 *
 * @param logger - logger for debug output
 *
 * @example
 * ```ts
 * await evictLruEntry({
 *   lru: lruSet,
 *   key: 'recently-accessed-key',
 *   backends: [primaryBackend, fallbackBackend],
 *   logger: { debug(msg) { console.debug(msg); } },
 * });
 * ```
 */
export async function evictLruEntry(
  {
    lru,
    key,
    backends,
    logger,
  }: Readonly<{
    lru: LruKeySet | null;
    key: string;
    backends: readonly [
      StorageBackend,
      ...StorageBackend[],
    ];
    logger: { readonly debug: (msg: string,) => void; };
  }>,
): Promise<void> {
  if (lru === null)
    return;
  /** Key displaced by the LRU touch, or `null` when nothing was evicted. */
  const evicted = lru.touch(key,);
  if (evicted === null)
    return;
  logger.debug(`store.evict: "${evicted}"`,);
  await Promise.all(
    backends.map(async function evictFromBackend(backend,) {
      await backend.delete(evicted,);
    },),
  );
}
