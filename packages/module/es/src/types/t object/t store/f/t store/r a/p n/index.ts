import superjson from 'superjson';
import decircular from 'decircular';

import type {
  $  as Store,
  StoreConfig,
  StorageBackend,
} from '../../../../t/r a/index.ts';
import type { Serializer, Deserializer, } from '../../../../t/index.ts';
import { $ as defaultLogger, } from '../../../../../t logger/f/t never/r s/p p/index.ts';
import {
  type BackendResult,
  computeCanonical,
  healBackends,
} from '../../../../consensus.ts';
import { hashString, } from '../../../../../../t string/f/_pendingRefactor_type string/hash.ts';

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
 * Query all backends for a key and return typed results with priority info.
 *
 * @param backends - storage backends to query
 * @param key - lookup key
 * @returns results from all backends
 *
 * @example
 * ```ts
 * const results = await queryAllBackends(backends, 'my-key');
 * ```
 */
async function queryAllBackends(
  backends: readonly [StorageBackend, ...StorageBackend[],],
  key: string,
): Promise<[BackendResult, ...BackendResult[],]> {
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
  return results as [BackendResult, ...BackendResult[],];
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
  results: readonly [BackendResult, ...BackendResult[],],
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
    throw new Error(`Store.get: no backend results for key "${key}"`,);
  }

  const groupedHighest = Map.groupBy(highestResults, function byValue({ value, },) {
    return value;
  },);

  return computeCanonical(results, groupedHighest, highestResults, key,);
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
// eslint-disable-next-line prefer-const
let defaultBackendsBuilder: DefaultBackendsBuilder | undefined;

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
 * Creates a Store instance, using platform-specific default backends
 * when none are provided in the config.
 *
 * Falls back to a single in-memory `Map` when no backends are configured
 * and no platform builder has been registered.
 *
 * @param config - store configuration
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
  const serializer: Serializer = config.serializer ?? superjson.stringify;
  const deserializer: Deserializer = config.deserializer ?? superjson.parse;
  const lossyForCircular = config.lossyForCircular ?? true;

  const backends: readonly [StorageBackend, ...StorageBackend[],] = config.backends
    ?? (defaultBackendsBuilder !== undefined
      ? await defaultBackendsBuilder({ storeId, },)
      : [new Map<string, string>(),]);

  defaultLogger.trace(`Store "${storeId}" created with ${String(backends.length)} backend(s)`,);

  const store: Store = {
    storeId,
    serializer,
    deserializer,
    lossyForCircular,
    backends,

    async set(key: string, value: unknown,): Promise<Store> {
      defaultLogger.trace(`Store.set: "${key}"`,);
      const serialized = serializeValue(value, serializer, lossyForCircular,);
      const resolvedKey = key.length === 0 ? await hashString(serialized,) : key;

      await Promise.all(
        backends.map(async function persistToBackend(backend,) {
          await backend.set(resolvedKey, serialized,);
        },),
      );

      return store;
    },

    async get<const T = unknown,>(key: string,): Promise<T | undefined> {
      defaultLogger.trace(`Store.get: "${key}"`,);
      const results = await queryAllBackends(backends, key,);
      const canonicalSerialized = resolveConsensus(results, key,);

      await healBackends(results, canonicalSerialized, key,);

      return canonicalSerialized === undefined
        ? undefined
        : deserializer<T>(canonicalSerialized,);
    },

    async delete(key: string,): Promise<void> {
      defaultLogger.trace(`Store.delete: "${key}"`,);
      await Promise.all(
        backends.map(async function deleteFromBackend(backend,) {
          await backend.delete(key,);
        },),
      );
    },

    async clear(): Promise<void> {
      defaultLogger.trace(`Store.clear`,);
      await Promise.all(
        backends.map(async function clearBackend(backend,) {
          // Map and similar backends support clear()
          if ('clear' in backend && typeof backend.clear === 'function') {
            await (backend.clear as () => unknown)();
          }
        },),
      );
    },
  };

  return store;
}
