import superjson from 'superjson';

import type {
  $  as Store,
  StoreConfig,
  StorageBackend,
} from '../../../../t/r a/index.ts';
import type { Serializer, Deserializer, } from '../../../../t/index.ts';
import { $ as defaultLogger, } from '../../../../../t logger/f/t never/r s/p p/index.ts';
import {
  type BackendResult,
  resolveConsensus,
  healBackends,
} from '../../../../consensus.ts';
import { hashString, } from '../../../../../../t string/f/_pendingRefactor_type string/hash.ts';
import { $ as serializeValue, } from '../../../../../../t string/f/t unknown/serialize/r s/p n/index.ts';

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
      const serialized = serializeValue({ value, serializer, lossyForCircular, },);
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
