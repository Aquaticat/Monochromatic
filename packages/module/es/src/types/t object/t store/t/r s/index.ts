import type {
  BaseStoreConfig,
  BaseStoreFields,
} from '../index.ts';

/**
 * Synchronous backend storage interface for SyncStore.
 * All operations return synchronously.
 * Compatible with `Map<string, string>`.
 *
 * @example
 * ```ts
 * const backend: SyncStorageBackend = new Map<string, string>();
 * ```
 */
export type SyncStorageBackend = {
  /**
   * Retrieve serialized value by key.
   *
   * @param key - lookup key
   * @returns serialized value or undefined when missing
   */
  get: (key: string,) => string | undefined;

  /**
   * Persist serialized value by key.
   *
   * @param key - storage key
   * @param value - serialized value to store
   */
  set: (
    key: string,
    value: string,
  ) => unknown;

  /**
   * Remove entry by key.
   *
   * @param key - key to remove
   */
  delete: (key: string,) => unknown;

  /**
   * Optional priority tier for consensus voting.
   * Higher values indicate higher trust.
   * Defaults to `0` when omitted.
   */
  priority?: number;
};

/**
 * Configuration for constructing a sync SyncStore.
 *
 * @example
 * ```ts
 * const config: SyncStoreConfig = {
 *   backends: [new Map<string, string>()],
 *   storeId: 'my-sync-cache',
 * };
 * ```
 */
export type SyncStoreConfig = BaseStoreConfig & {
  /**
   * Ordered synchronous storage backends with optional priorities for consensus.
   * Falls back to a single in-memory `Map` when omitted.
   */
  backends?: readonly [
    SyncStorageBackend,
    ...SyncStorageBackend[],
  ];
};

/**
 * Synchronous multi-backend key-value store with consensus and self-healing.
 *
 * All operations are synchronous. Persists serialized values across one or more
 * {@link SyncStorageBackend} instances.
 * When reading, computes a canonical value via majority vote:
 * - Majority across all tiers wins
 * - On tie, majority in highest priority tier wins
 * - If still tied, throws an error
 *
 * After determining the canonical value, heals all backends to match.
 *
 * @example
 * ```ts
 * import { $ as createSyncStore } from './f/t store/r s/p n/index.ts';
 * const store = createSyncStore({ storeId: 'demo' });
 * store.set('key', { data: 42 });
 * const value = store.get<{ data: number }>('key');
 * ```
 */
export type $ = BaseStoreFields<SyncStorageBackend> & {
  /**
   * Persist a value by key.
   *
   * @param key - storage key
   * @param value - data to persist
   * @returns this store for chaining
   */
  set: (
    key: string,
    value: unknown,
  ) => $;

  /**
   * Read value by key using consensus and heal backends to canonical result.
   *
   * @typeParam T - expected deserialized value type
   * @param key - lookup key
   * @returns deserialized value or undefined when not found
   */
  get: <const T = unknown,>(key: string,) => T | undefined;

  /**
   * Remove entry by key across all backends.
   *
   * @param key - key to remove
   */
  delete: (key: string,) => void;

  /**
   * Remove all entries across all backends that support clearing.
   */
  clear: () => void;

  /**
   * Current number of entries (available when all backends support `.size`).
   * Returns the size of the first backend that exposes it, or `0`.
   */
  readonly size: number;
};
