import type { Promisable, } from 'type-fest';

import type {
  BaseStoreConfig,
  BaseStoreFields,
} from '../index.ts';

/**
 * Backend storage interface for Store.
 * Compatible with `Map<string, string>` and the Web Storage API shape.
 *
 * @example
 * ```ts
 * const backend: StorageBackend = new Map<string, string>();
 * ```
 */
export type StorageBackend = {
  /**
   * Retrieve serialized value by key.
   *
   * @param key - lookup key
   * @returns serialized value or undefined/null when missing
   */
  get: (key: string,) => Promisable<string | undefined | null>;

  /**
   * Persist serialized value by key.
   *
   * @param key - storage key
   * @param value - serialized value to store
   */
  set: (key: string, value: string,) => Promisable<unknown>;

  /**
   * Remove entry by key.
   *
   * @param key - key to remove
   */
  delete: (key: string,) => Promisable<unknown>;

  /**
   * Optional priority tier for consensus voting.
   * Higher values indicate higher trust.
   * Defaults to `0` when omitted.
   */
  priority?: number;
};

/**
 * Configuration for constructing an async Store.
 *
 * @example
 * ```ts
 * const config: StoreConfig = {
 *   backends: [new Map<string, string>()],
 *   storeId: 'my-cache',
 * };
 * ```
 */
export type StoreConfig = BaseStoreConfig & {
  /**
   * Ordered storage backends with optional priorities for consensus.
   * Falls back to a single in-memory `Map` when omitted.
   */
  backends?: readonly [
    StorageBackend,
    ...StorageBackend[],
  ];
};

/**
 * Multi-backend key-value store with consensus and self-healing.
 *
 * Persists serialized values across one or more {@link StorageBackend} instances.
 * When reading, computes a canonical value via majority vote:
 * - Majority across all tiers wins
 * - On tie, majority in highest priority tier wins
 * - If still tied, throws an error
 *
 * After determining the canonical value, heals all backends to match.
 *
 * @example
 * ```ts
 * import { $ as createStore } from './f/t store/r a/p n/index.ts';
 * const store = await createStore({ storeId: 'demo' });
 * await store.set('key', { data: 42 });
 * const value = await store.get<{ data: number }>('key');
 * ```
 */
export type $ = BaseStoreFields<StorageBackend> & {
  /**
   * Persist a value by key.
   * When key is omitted, derives one from the content hash.
   *
   * @param key - storage key
   * @param value - data to persist
   * @returns this store for chaining
   */
  set: (key: string, value: unknown,) => Promise<$>;

  /**
   * Read value by key using consensus and heal backends to canonical result.
   *
   * @typeParam T - expected deserialized value type
   * @param key - lookup key
   * @returns deserialized value or undefined when not found
   */
  get: <const T = unknown,>(key: string,) => Promise<T | undefined>;

  /**
   * Remove entry by key across all backends.
   *
   * @param key - key to remove
   */
  delete: (key: string,) => Promise<void>;

  /**
   * Remove all entries across all backends that support clearing.
   */
  clear: () => Promise<void>;
};
