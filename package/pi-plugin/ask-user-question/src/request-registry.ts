//region Registry

/**
 Tracks active external-answer controllers for session shutdown cleanup.
 
 @example
 ```ts
 const registry = createRequestRegistry();
 using request = registry.open();
 ```
 */
export type RequestRegistry = {
  /**
   Opens one active request cancellation scope.
   */
  readonly open: () => Disposable & {
    readonly signal: AbortSignal;
    readonly abort: () => void;
  };
  /**
   Aborts every active request and empties registry.
   */
  readonly abortAll: () => void;
};

/**
 Creates session-scoped registry for pending answer requests.
 
 @returns request cancellation registry
 
 @example
 ```ts
 const registry = createRequestRegistry();
 registry.abortAll();
 ```
 */
export function createRequestRegistry(): RequestRegistry {
  /**
   Mutable controller set owned by one extension instance.
   */
  const controllers = new Set<AbortController>();
  return {
    open(): Disposable & {
      readonly signal: AbortSignal;
      readonly abort: () => void;
    } {
      /**
       Controller cancelled by session shutdown.
       */
      const controller = new AbortController();
      controllers.add(controller,);
      return {
        signal: controller.signal,
        abort(): void {
          controller.abort();
        },
        [Symbol.dispose](): void {
          controllers.delete(controller,);
        },
      };
    },
    abortAll(): void {
      for (const controller of controllers)
        controller.abort();
      controllers.clear();
    },
  };
}

//endregion Registry
