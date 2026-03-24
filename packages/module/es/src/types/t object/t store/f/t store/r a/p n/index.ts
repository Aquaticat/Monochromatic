import superjson from 'superjson';

import {
  hashString,
} from '../../../../../../t string/f/_pendingRefactor_type string/hash.ts';
import {
  $ as serializeValue,
} from '../../../../../../t string/f/t unknown/serialize/r s/p n/index.ts';
import { $ as defaultLogger, } from '../../../../../t logger/f/t never/r s/p p/index.ts';
import { resolveConsensus, } from '../../../../consensus.ts';
import { healBackends, } from '../../../../heal.ts';
import { createLruKeySet, } from '../../../../lruKeySet.ts';
import type {
  Deserializer,
  Serializer,
} from '../../../../t/index.ts';
import type {
  $ as Store,
  StorageBackend,
  StoreConfig,
} from '../../../../t/r a/index.ts';
import {
  evictLruEntry,
  getDefaultBackendsBuilder,
  queryAllBackends,
} from './backends.ts';

export type { DefaultBackendsBuilder, } from './backends.ts';
export { configureDefaultBackendsBuilder, } from './backends.ts';

/**
 * Creates a Store instance, using platform-specific default backends
 * when none are provided in the config.
 *
 * Falls back to a single in-memory `Map` when no backends are configured
 * and no platform builder has been registered.
 *
 * When {@link StoreConfig.eviction} is set, the store tracks access order
 * and evicts entries according to the configured policy.
 *
 * @param config - store configuration
 *
 * @returns initialized Store
 *
 * @example
 * ```ts
 * const store = await $({ storeId: 'my-cache' });
 * await store.set('key', [1, 2, 3]);
 * const arr = await store.get<number[]>('key');
 * ```
 *
 * @example
 * LRU-bounded store:
 * ```ts
 * const store = await $({
 *   storeId: 'bounded',
 *   eviction: [{ policy: 'lru', maxSize: 256 }],
 * });
 * ```
 *
 * @example
 * Custom backends:
 * ```ts
 * const memoryBackend = new Map<string, string>();
 * const store = await $({
 *   backends: [memoryBackend],
 *   storeId: 'custom',
 * });
 * ```
 */
export async function $(config: StoreConfig = {},): Promise<Store> {
  const storeId = config.storeId ?? crypto.randomUUID();
  // oxlint-disable-next-line import/no-named-as-default-member -- superjson default export provides stringify/parse as methods
  const serializer: Serializer = config.serializer ?? superjson.stringify;
  // oxlint-disable-next-line import/no-named-as-default-member -- superjson default export provides stringify/parse as methods
  const deserializer: Deserializer = config.deserializer ?? superjson.parse;
  const lossyForCircular = config.lossyForCircular ?? true;

  const defaultBackendsBuilder = getDefaultBackendsBuilder();
  const backends: readonly [StorageBackend, ...StorageBackend[],] = config.backends
    ?? (defaultBackendsBuilder !== undefined
      ? await defaultBackendsBuilder({ storeId, },)
      : [new Map<string, string>(),]);

  const policies = config.eviction ?? [];
  const lruPolicy = policies.find(function isLru(p,) {
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- future-proofing: more eviction policies will be added
    return p.policy === 'lru';
  },);
  const lru = lruPolicy !== undefined
    ? createLruKeySet(lruPolicy.maxSize,)
    : undefined;

  defaultLogger.debug(
    `Store "${storeId}" created with ${String(backends.length,)} backend(s)`,
  );

  const store: Store = {
    storeId,
    serializer,
    deserializer,
    lossyForCircular,
    backends,

    async set(key: string, value: unknown,): Promise<Store> {
      defaultLogger.debug(`Store.set: "${key}"`,);
      const serialized = serializeValue({ value, serializer, lossyForCircular, },);
      const resolvedKey = key.length === 0 ? await hashString(serialized,) : key;

      await Promise.all(
        backends.map(async function persistToBackend(backend,) {
          await backend.set(resolvedKey, serialized,);
        },),
      );

      await evictLruEntry({ lru, key: resolvedKey, backends, logger: defaultLogger, },);

      return store;
    },

    async get<const T = unknown,>(key: string,): Promise<T | undefined> {
      defaultLogger.debug(`Store.get: "${key}"`,);
      const results = await queryAllBackends(backends, key,);
      const canonicalSerialized = resolveConsensus(results, key,);

      await healBackends(results, canonicalSerialized, key,);

      if (canonicalSerialized !== undefined)
        await evictLruEntry({ lru, key, backends, logger: defaultLogger, },);

      return canonicalSerialized === undefined
        ? undefined
        : deserializer<T>(canonicalSerialized,);
    },

    async delete(key: string,): Promise<void> {
      defaultLogger.debug(`Store.delete: "${key}"`,);
      if (lru !== undefined)
        lru.remove(key,);
      await Promise.all(
        backends.map(async function deleteFromBackend(backend,) {
          await backend.delete(key,);
        },),
      );
    },

    async clear(): Promise<void> {
      defaultLogger.debug(`Store.clear`,);
      if (lru !== undefined)
        lru.clear();
      await Promise.all(
        backends.map(async function clearBackend(backend,) {
          // Map and similar backends support clear()
          if ('clear' in backend && typeof backend.clear === 'function') {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- runtime check confirms clear is a function
            await (backend.clear as () => unknown)();
          }
        },),
      );
    },
  };

  return store;
}
