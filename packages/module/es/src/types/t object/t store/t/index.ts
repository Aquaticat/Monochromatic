export * as async from './r a/index.ts';
export * as sync from './r s/index.ts';

/**
 * Serialize unknown data to deterministic string form.
 *
 * @example
 * ```ts
 * const serialize: Serializer = JSON.stringify;
 * ```
 */
export type Serializer = (toSerialize: unknown,) => string;

/**
 * Deserialize string data into typed value.
 *
 * @typeParam T - target value type
 *
 * @example
 * ```ts
 * const deserialize: Deserializer = JSON.parse;
 * ```
 */
export type Deserializer = <const T = unknown,>(toDeserialize: string,) => T;

/**
 * Shared configuration fields for both sync and async store constructors.
 * Extended by `StoreConfig` and `SyncStoreConfig` which add their
 * backend-specific `backends` field.
 *
 * @example
 * ```ts
 * const base: BaseStoreConfig = {
 *   storeId: 'my-cache',
 *   lossyForCircular: false,
 * };
 * ```
 */
export type BaseStoreConfig = {
  /** Serializer for persisted values. Defaults to `superjson.stringify`. */
  serializer?: Serializer;
  /** Deserializer for loaded values. Defaults to `superjson.parse`. */
  deserializer?: Deserializer;
  /**
   * When true, cyclic graphs are decycled and persisted lossy instead of throwing.
   * Defaults to `true`.
   */
  lossyForCircular?: boolean;
  /** Unique identifier used for namespacing. Defaults to random UUID. */
  storeId?: string;
};

/**
 * Shared readonly fields exposed on both sync and async store instances.
 * Extended by async `$` and sync `$` which add their method signatures.
 *
 * @typeParam TBackend - storage backend type
 *
 * @example
 * ```ts
 * function logStoreInfo(store: BaseStoreFields<StorageBackend>): void {
 *   console.log(store.storeId, store.backends.length);
 * }
 * ```
 */
export type BaseStoreFields<TBackend,> = {
  /** Unique identifier for this store instance. */
  readonly storeId: string;
  /** Serializer used when persisting values. */
  readonly serializer: Serializer;
  /** Deserializer used when loading values. */
  readonly deserializer: Deserializer;
  /** Whether to accept lossy serialization of cyclic graphs. */
  readonly lossyForCircular: boolean;
  /** Ordered backends used by this store. */
  readonly backends: readonly [TBackend, ...TBackend[],];
};
