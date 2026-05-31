/**
 * Storage abstraction used by the rebuild pipeline and the read path.
 *
 * Implementations must satisfy:
 *
 * - `put`/`putBatch` are atomic from the reader's perspective: a `get`
 *   either returns the previous content or the new content, never a torn
 *   intermediate state.
 * - `get` returns `undefined` for unknown keys.
 * - `delete` is idempotent: deleting an unknown key is not an error.
 * - `list` returns keys in lexicographic order; pagination is the caller's
 *   problem when the namespace is huge.
 *
 * Phase 1 ships only `adapter-memory.ts`; Phase 2 adds an S3-compatible
 * adapter against R2 in prod and Garage in stress tests.
 */

/**
 * A single put operation supplied to {@link Storage.putBatch}.
 */
export type StoragePutItem = {
  /**
   * Storage key.
   */
  readonly key: string;

  /**
   * Body bytes to write.
   */
  readonly body: Uint8Array;
};

/**
 * Object-storage interface implemented by every adapter.
 */
export type Storage = {
  /**
   * Writes a single object. Resolves once the write is durable from the
   * reader's perspective.
   *
   * @param key - storage key
   *
   * @param body - bytes to write
   */
  put(
    key: string,
    body: Uint8Array,
  ): Promise<void>;

  /**
   * Writes many objects. Implementations may parallelise internally; the
   * caller does not need to chunk before invoking.
   *
   * @param items - put operations to issue
   */
  putBatch(items: readonly StoragePutItem[],): Promise<void>;

  /**
   * Reads a single object.
   *
   * @param key - storage key
   *
   * @returns body bytes, or `undefined` when the key is absent
   */
  get(key: string,): Promise<Uint8Array | undefined>;

  /**
   * Deletes a single object. Idempotent.
   *
   * @param key - storage key
   */
  delete(key: string,): Promise<void>;

  /**
   * Lists keys in lexicographic order. Optional prefix filter.
   *
   * @param prefix - prefix filter; empty string lists everything
   *
   * @returns sorted keys array
   */
  list(prefix: string,): Promise<string[]>;
};
