/**
 Structural view of the R2 bucket binding the Worker depends on.

 Declared here instead of importing Cloudflare's runtime types so unit tests can
 substitute an in-memory store and the handlers stay typed against web
 standards only. Cloudflare's `R2Bucket` satisfies the shape unchanged.

 @module
 */

/**
 Metadata a head lookup returns: the byte length the object was stored with.
 */
export type StoredObjectHead = {
  /**
   Byte length of the stored object.
   */
  readonly size: number;
};

/**
 Stored object together with its streaming body.
 */
export type StoredObject = StoredObjectHead & {
  /**
   Object bytes as a readable stream.
   */
  readonly body: ReadableStream<Uint8Array>;
};

/**
 Minimal key-value object store the handlers need.

 The method signatures mirror `R2Bucket` so the binding is assignable without
 an adapter; they keep positional parameters for that reason instead of the
 single-object-parameter convention, and `head` and `get` mirror R2's `null`
 for an absent key because the binding cannot be reshaped before it reaches
 the Worker.
 */
export type ObjectStore = {
  /**
   Look up size metadata without reading the body; `null` when absent.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- mirrors Cloudflare R2Bucket.head, which resolves to null for an absent key and is bound by the platform, not constructed here
  readonly head: (key: string,) => Promise<StoredObjectHead | null>;
  /**
   Read the object and its body; `null` when absent.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- mirrors Cloudflare R2Bucket.get, which resolves to null for an absent key and is bound by the platform, not constructed here
  readonly get: (key: string,) => Promise<StoredObject | null>;
  /**
   Store `body` under `key`, replacing any previous object.
   */
  readonly put: (
    key: string,
    body: ReadableStream<Uint8Array>,
  ) => Promise<unknown>;
};

/**
 Bindings and secrets wrangler hands the Worker on every request.
 */
export type WorkerEnv = {
  /**
   R2 bucket binding declared in `wrangler.toml`.
   */
  readonly BUCKET: ObjectStore;
  /**
   Shared upload secret set with `wrangler secret put`; absent until it is
   set, and every write is refused while absent.
   */
  readonly LFS_WRITE_TOKEN?: string;
};

/**
 Structural view of the execution context wrangler passes as the third
 handler argument; only `waitUntil` is needed, to keep the log flush alive
 after the response is returned.
 */
export type ExecutionContextLike = {
  /**
   Extend the request lifetime until `promise` settles.
   */
  readonly waitUntil: (promise: Promise<unknown>,) => void;
};
