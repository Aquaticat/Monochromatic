import {
  parse as superjsonParse,
  stringify as superjsonStringify,
} from 'superjson';

import { logger as defaultLogger, } from '@monochromatic-dev/module-logger/logger';
import {
  $ as serializeValue,
} from '../../../../../../t string/f/t unknown/serialize/r s/p n/index.ts';
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
  /** Caller-supplied identifier or freshly minted UUID; used in debug logs to disambiguate stores. */
  const storeId = config.storeId ?? crypto.randomUUID();
  /** Serializer applied on every `set`; defaults to superjson so structured values round-trip through string backends. */
  const serializer: Serializer = config.serializer ?? superjsonStringify;
  /**
   * Deserializer applied on every `get`; paired with {@link serializer}'s default so superjson output decodes correctly.
   */
  const deserializer: Deserializer = config.deserializer ?? superjsonParse;
  /** When `true`, circular structures are serialized lossily instead of throwing; opt-in safety net for graph-shaped values. */
  const lossyForCircular = config.lossyForCircular ?? true;
  /** Non-empty list of storage backends queried in order; defaults to a single in-memory Map for ad-hoc stores. */
  const backends: readonly [
    SyncStorageBackend,
    ...SyncStorageBackend[],
  ] = config.backends
    ?? [new Map<string, string>(),];

  /** Configured eviction policies; empty array means unbounded growth. */
  const policies = config.eviction ?? [];
  /** First LRU policy in the list, or undefined when LRU is not configured. */
  const lruPolicy = policies.find(function isLru(p,) {
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- future-proofing: more eviction policies will be added
    return p.policy === 'lru';
  },);
  /**
   * LRU access tracker bounded by {@link lruPolicy}'s `maxSize`, or undefined when LRU is not configured.
   */
  const lru = lruPolicy !== undefined
    ? createLruKeySet(lruPolicy.maxSize,)
    : undefined;

  defaultLogger.debug(
    `SyncStore "${storeId}" created with ${String(backends.length,)} backend(s)`,
  );

  /** Exposed SyncStore instance; declared as a binding so member methods can self-reference for chaining. */
  const store: SyncStore = {
    storeId,
    serializer,
    deserializer,
    lossyForCircular,
    backends,

    /** Number of entries in the primary backend, or `0` when unavailable. */
    get size(): number {
      /** Primary backend; size is reported from this one when it exposes a numeric `size`. */
      const [first,] = backends;
      if (('size' in first) && ((typeof first.size) === 'number'))
        return first.size;
      return 0;
    },

    set(
      key: string,
      value: unknown,
    ): SyncStore {
      defaultLogger.debug(`SyncStore.set: "${key}"`,);
      /** Serialized form written to every backend; computed once so all backends agree on byte-identical content. */
      const serialized = serializeValue({
        value,
        serializer,
        lossyForCircular,
      },);

      for (const backend of backends) {
        backend.set(
          key,
          serialized,
        );
      }

      if (lru !== undefined) {
        /** Key the LRU tracker chose to drop, or undefined when below capacity. */
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
      /** Per-backend lookup results; feeds both consensus resolution and the healing pass. */
      const results = queryAllBackendsSync({
        backends,
        key,
      },);
      /** Consensus value across backends, or undefined when no backend held the key. */
      const canonicalSerialized = resolveConsensus({
        results,
        key,
      },);

      healBackendsSync({
        results,
        canonicalSerialized,
        key,
      },);

      if ((canonicalSerialized !== undefined) && (lru !== undefined)) {
        /** Key the LRU tracker chose to drop on access, or undefined when below capacity. */
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
        if (('clear' in backend) && ((typeof backend.clear) === 'function')) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- runtime check confirms clear is a function
          (backend.clear as () => unknown)();
        }
      }
    },
  };

  return store;
}
