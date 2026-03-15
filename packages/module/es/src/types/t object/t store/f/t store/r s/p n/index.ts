import superjson from 'superjson';

import {
  $ as serializeValue,
} from '../../../../../../t string/f/t unknown/serialize/r s/p n/index.ts';
import { $ as defaultLogger, } from '../../../../../t logger/f/t never/r s/p p/index.ts';
import { resolveConsensus, } from '../../../../consensus.ts';
import { healBackendsSync, } from '../../../../heal.ts';
import { createLruKeySet, } from '../../../../lruKeySet.ts';
import type {
  Deserializer,
  Serializer,
} from '../../../../t/index.ts';
import type {
  $ as SyncStore,
  SyncStorageBackend,
  SyncStoreConfig,
} from '../../../../t/r s/index.ts';
import { queryAllBackendsSync, } from './backends.ts';

/**
 * Creates a synchronous Store instance where all operations (get, set, delete, clear)
 * are synchronous. Backends must implement {@link SyncStorageBackend}.
 * Defaults to an in-memory `Map` when no backends are provided.
 *
 * When {@link SyncStoreConfig.eviction} is set, the store tracks access order
 * and evicts entries according to the configured policy.
 *
 * @param config - store configuration
 *
 * @returns initialized sync Store
 *
 * @example
 * ```ts
 * const store = $({ storeId: 'my-cache' });
 * store.set('key', { data: 42 });
 * const value = store.get<{ data: number }>('key');
 * ```
 *
 * @example
 * LRU-bounded store:
 * ```ts
 * const store = $({
 *   storeId: 'bounded',
 *   eviction: [{ policy: 'lru', maxSize: 256 }],
 * });
 * ```
 *
 * @example
 * Custom backends:
 * ```ts
 * const memoryBackend = new Map<string, string>();
 * const store = $({
 *   backends: [memoryBackend],
 *   storeId: 'custom',
 * });
 * ```
 *
 * @example
 * Multiple backends with consensus:
 * ```ts
 * const backend1 = new Map<string, string>();
 * const backend2 = new Map<string, string>();
 * const store = $({
 *   backends: [backend1, backend2],
 *   storeId: 'replicated',
 * });
 * store.set('key', 'value');
 * // Both backends now hold the serialized value
 * ```
 */
export function $(config: SyncStoreConfig = {},): SyncStore {
  const storeId = config.storeId ?? crypto.randomUUID();
  const serializer: Serializer = config.serializer ?? superjson.stringify;
  const deserializer: Deserializer = config.deserializer ?? superjson.parse;
  const lossyForCircular = config.lossyForCircular ?? true;
  const backends: readonly [SyncStorageBackend, ...SyncStorageBackend[],] =
    config.backends
      ?? [new Map<string, string>(),];

  const policies = config.eviction ?? [];
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- future-proofing: more eviction policies will be added
  const lruPolicy = policies.find(function isLru(p,) {
    return p.policy === 'lru';
  },);
  const lru = lruPolicy !== undefined
    ? createLruKeySet(lruPolicy.maxSize,)
    : undefined;

  defaultLogger.debug(
    `SyncStore "${storeId}" created with ${String(backends.length,)} backend(s)`,
  );

  const store: SyncStore = {
    storeId,
    serializer,
    deserializer,
    lossyForCircular,
    backends,

    /** Number of entries in the primary backend, or `0` when unavailable. */
    get size(): number {
      const first = backends[0];
      if ('size' in first && typeof first.size === 'number')
        return first.size;
      return 0;
    },

    set(key: string, value: unknown,): SyncStore {
      defaultLogger.debug(`SyncStore.set: "${key}"`,);
      const serialized = serializeValue({ value, serializer, lossyForCircular, },);

      for (const backend of backends)
        backend.set(key, serialized,);

      if (lru !== undefined) {
        const evicted = lru.touch(key,);
        if (evicted !== undefined) {
          defaultLogger.debug(`SyncStore.evict: "${evicted}"`,);
          for (const backend of backends)
            backend.delete(evicted,);
        }
      }

      return store;
    },

    get<const T = unknown,>(key: string,): T | undefined {
      defaultLogger.debug(`SyncStore.get: "${key}"`,);
      const results = queryAllBackendsSync(backends, key,);
      const canonicalSerialized = resolveConsensus(results, key,);

      healBackendsSync(results, canonicalSerialized, key,);

      if (canonicalSerialized !== undefined && lru !== undefined) {
        const evicted = lru.touch(key,);
        if (evicted !== undefined) {
          defaultLogger.debug(`SyncStore.evict: "${evicted}"`,);
          for (const backend of backends)
            backend.delete(evicted,);
        }
      }

      return canonicalSerialized === undefined
        ? undefined
        : deserializer<T>(canonicalSerialized,);
    },

    delete(key: string,): void {
      defaultLogger.debug(`SyncStore.delete: "${key}"`,);
      if (lru !== undefined)
        lru.remove(key,);
      for (const backend of backends)
        backend.delete(key,);
    },

    clear(): void {
      defaultLogger.debug(`SyncStore.clear`,);
      if (lru !== undefined)
        lru.clear();
      for (const backend of backends) {
        if ('clear' in backend && typeof backend.clear === 'function')
          (backend.clear as () => unknown)();
      }
    },
  };

  return store;
}
