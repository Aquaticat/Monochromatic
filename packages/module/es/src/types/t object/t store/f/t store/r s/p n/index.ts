import superjson from 'superjson';
import decircular from 'decircular';

import type {
  $  as SyncStore,
  SyncStorageBackend,
  SyncStoreConfig,
} from '../../../../t/r s/index.ts';
import type { Serializer, Deserializer, } from '../../../../t/index.ts';
import { $ as defaultLogger, } from '../../../../../t logger/f/t never/r s/p p/index.ts';
import {
  type BackendResult,
  computeCanonical,
  healBackendsSync,
} from '../../../../consensus.ts';

/**
 * Detect whether a value contains circular references.
 *
 * @param value - value to inspect
 * @returns true when cyclic
 *
 * @example
 * ```ts
 * const obj: Record<string, unknown> = {};
 * obj.self = obj;
 * hasCycle(obj); // true
 * ```
 */
function hasCycle(value: unknown,): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  /** Tracks visited object references. */
  const seen = new WeakSet();

  /** Stack-based iterative cycle detection. */
  const stack: unknown[] = [value,];

  // Intentional mutation: stack is consumed during traversal
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stack shrinks via pop
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current !== 'object' || current === null) {
      continue;
    }
    if (seen.has(current,)) {
      return true;
    }
    seen.add(current,);
    for (const child of Object.values(current,)) {
      stack.push(child,);
    }
  }

  return false;
}

/** Max characters for value previews in log messages when no limit is specified. */
const DEFAULT_LOG_LIMIT = 100;

/**
 * Serialize a value for storage, handling cyclic graphs based on configuration.
 *
 * @param value - input data to serialize
 * @param serializer - serialization function
 * @param lossyForCircular - whether to allow lossy decycling
 * @returns serialized string
 * @throws TypeError when cyclic and lossyForCircular is false
 *
 * @example
 * ```ts
 * const serialized = serializeValue({ x: 1 }, JSON.stringify, true);
 * ```
 */
function serializeValue(
  value: unknown,
  serializer: Serializer,
  lossyForCircular: boolean,
): string {
  if (hasCycle(value,)) {
    const decycled = decircular(value as object,);
    const serialized = serializer(decycled,);
    if (!lossyForCircular) {
      throw new TypeError(
        `Cannot store value perfectly because it has cycles: ${serialized.slice(0, DEFAULT_LOG_LIMIT,)}`,
      );
    }
    defaultLogger.warn(
      `Value has cycles, storing decycled version: ${serialized.slice(0, DEFAULT_LOG_LIMIT,)}`,
    );
    return serialized;
  }
  return serializer(value,);
}

/**
 * Query all sync backends for a key and return typed results with priority info.
 *
 * @param backends - sync storage backends to query
 * @param key - lookup key
 * @returns results from all backends
 *
 * @example
 * ```ts
 * const results = queryAllBackendsSync(backends, 'my-key');
 * ```
 */
function queryAllBackendsSync(
  backends: readonly [SyncStorageBackend, ...SyncStorageBackend[],],
  key: string,
): [BackendResult<SyncStorageBackend>, ...BackendResult<SyncStorageBackend>[],] {
  const results = backends.map(function queryBackend(backend,) {
    const raw = backend.get(key,);
    return {
      value: raw === undefined ? undefined : raw,
      priority: backend.priority ?? 0,
      backend,
    };
  },);
  return results as [BackendResult<SyncStorageBackend>, ...BackendResult<SyncStorageBackend>[],];
}

/**
 * Resolve canonical value from backend results via consensus.
 *
 * @param results - backend query results
 * @param key - lookup key for error messages
 * @returns canonical serialized value or undefined
 *
 * @example
 * ```ts
 * const canonical = resolveConsensus(results, 'my-key');
 * ```
 */
function resolveConsensus(
  results: readonly [BackendResult<SyncStorageBackend>, ...BackendResult<SyncStorageBackend>[],],
  key: string,
): string | undefined {
  const grouped = Map.groupBy(results, function byPriority({ priority, },) {
    return priority;
  },);

  const sortedTiers = Array
    .from(grouped.entries(),)
    .toSorted(function byAscPriority([priorityA,], [priorityB,],) {
      return priorityA - priorityB;
    },)
    .map(function extractResults([, tierResults,],) {
      return tierResults;
    },);

  const highestResults = sortedTiers.at(-1,);
  if (highestResults === undefined || highestResults.length === 0) {
    throw new Error(`SyncStore.get: no backend results for key "${key}"`,);
  }

  const groupedHighest = Map.groupBy(highestResults, function byValue({ value, },) {
    return value;
  },);

  return computeCanonical(results, groupedHighest, highestResults, key,);
}

/**
 * Creates a synchronous Store instance where all operations (get, set, delete, clear)
 * are synchronous. Backends must implement {@link SyncStorageBackend}.
 * Defaults to an in-memory `Map` when no backends are provided.
 *
 * @param config - store configuration
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
  const backends: readonly [SyncStorageBackend, ...SyncStorageBackend[],] = config.backends
    ?? [new Map<string, string>(),];

  defaultLogger.trace(`SyncStore "${storeId}" created with ${String(backends.length)} backend(s)`,);

  const store: SyncStore = {
    storeId,
    serializer,
    deserializer,
    lossyForCircular,
    backends,

    get size(): number {
      const first = backends[0];
      if ('size' in first && typeof first.size === 'number') {
        return first.size;
      }
      return 0;
    },

    set(key: string, value: unknown,): SyncStore {
      defaultLogger.trace(`SyncStore.set: "${key}"`,);
      const serialized = serializeValue(value, serializer, lossyForCircular,);

      for (const backend of backends) {
        backend.set(key, serialized,);
      }

      return store;
    },

    get<const T = unknown,>(key: string,): T | undefined {
      defaultLogger.trace(`SyncStore.get: "${key}"`,);
      const results = queryAllBackendsSync(backends, key,);
      const canonicalSerialized = resolveConsensus(results, key,);

      healBackendsSync(results, canonicalSerialized, key,);

      return canonicalSerialized === undefined
        ? undefined
        : deserializer<T>(canonicalSerialized,);
    },

    delete(key: string,): void {
      defaultLogger.trace(`SyncStore.delete: "${key}"`,);
      for (const backend of backends) {
        backend.delete(key,);
      }
    },

    clear(): void {
      defaultLogger.trace(`SyncStore.clear`,);
      for (const backend of backends) {
        if ('clear' in backend && typeof backend.clear === 'function') {
          (backend.clear as () => unknown)();
        }
      }
    },
  };

  return store;
}
