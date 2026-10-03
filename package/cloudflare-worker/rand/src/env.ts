/**
 Structural views of the platform objects wrangler hands the Worker.

 Declared here instead of importing Cloudflare's runtime types so unit tests
 can substitute plain objects and the handlers stay typed against web
 standards only.

 @module
 */

//region Types

/**
 Bindings and secrets wrangler hands the Worker on every request.

 Typed `unknown` because this Worker reads nothing from it: `wrangler.toml`
 declares no R2, KV, or D1 binding and no plaintext var, so every response is
 computed from the request alone. The parameter exists only because workerd
 passes env positionally, ahead of the execution context.
 */
export type WorkerEnv = unknown;

/**
 Structural view of the execution context wrangler passes as the third handler
 argument; only `waitUntil` is needed, to keep the log flush alive after the
 response is returned.
 */
export type ExecutionContextLike = {
  /**
   Extend the request lifetime until `promise` settles.
   */
  readonly waitUntil: (promise: Promise<unknown>,) => void;
};

//endregion Types
