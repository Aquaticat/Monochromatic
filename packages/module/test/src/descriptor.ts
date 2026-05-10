/**
 * Shared primitive backing `describe` and `it`: a lazy
 * thenable that defers its body until first `.then` is called.
 *
 * Why lazy: the previous design's eager promises forced callers to
 * wrap children in thunks `() => it(...)` whenever sequential
 * execution was needed, because the test would have already started
 * by the time the parent suite saw the child. With lazy thenables,
 * `concurrency: 1` flowing through a `for...of await` loop dispatches
 * children one at a time without thunk wrapping.
 *
 * @module
 */

/**
 * Symbol-keyed dispatch method. Parent suites call this on each child
 * instead of awaiting `.then` directly, so the parent's effective
 * concurrency flows down as inheritance context. Symbol-keyed to keep
 * out of the public type surface; consumers only see `then`.
 */
export const RUN_WITH_CONTEXT: unique symbol = Symbol('runWithContext',);

/**
 * Inherited execution context. The parent suite computes its own
 * `effectiveConcurrency` and passes it to each child; the child
 * falls back to this value when its own `opts.concurrency` is unset.
 */
export type DescriptorContext = {
  /** Concurrency the parent suite settled on for its children. */
  readonly effectiveConcurrency: number;
};

/**
 * Lazy test descriptor. Awaiting (or otherwise `.then`-ing) starts
 * execution; the parent suite uses {@link RUN_WITH_CONTEXT} to dispatch
 * with an inherited context.
 *
 * No memoisation: each dispatch invokes the run function fresh,
 * matching the behaviour of the thunk pattern this design replaces.
 * `describe.repeats` and `it.repeats` rely on re-dispatch per iteration.
 */
export type TestDescriptor<T,> = PromiseLike<T> & {
  readonly [RUN_WITH_CONTEXT]: (ctx: DescriptorContext,) => Promise<T>;
};

/**
 * Default maximum number of children running at the same time.
 */
export const DEFAULT_CONCURRENCY = 16;

/**
 * Wraps a run function as a lazy {@link TestDescriptor}.
 * Top-level `await` enters via `then` with a root context
 * ({@link DEFAULT_CONCURRENCY}); parent suites enter via
 * {@link RUN_WITH_CONTEXT} with their own effective concurrency.
 *
 * @param run - function that performs the test body given a context
 *
 * @returns lazy descriptor satisfying {@link TestDescriptor}
 *
 * @example
 * ```ts
 * function it(opts: ItOptions): TestDescriptor<ItResult> {
 *   return makeDescriptor(function runItIgnoringCtx() { return runIt(opts); });
 * }
 * ```
 */
export function makeDescriptor<T,>(
  run: (ctx: DescriptorContext,) => Promise<T>,
): TestDescriptor<T> {
  /**
   * PromiseLike contract entry point. Top-level `await` lands here with
   * a root context (default concurrency); parent suites bypass this in
   * favour of {@link RUN_WITH_CONTEXT} to propagate inheritance.
   *
   * @param onfulfilled - resolution handler forwarded to the run promise
   *
   * @param onrejected - rejection handler forwarded to the run promise
   *
   * @returns chained PromiseLike resolving to the handler result
   */
  function then<R1 = T, R2 = never,>(
    onfulfilled?: ((value: T,) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown,) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return run({ effectiveConcurrency: DEFAULT_CONCURRENCY, },)
      .then(
        onfulfilled,
        onrejected,
      );
  }
  /**
   * Internal entry point used by parent suites to dispatch with an
   * inherited context. Bypasses the root-context default of {@link then}.
   *
   * @param ctx - inherited execution context from the parent suite
   *
   * @returns promise resolving to the run result
   */
  function runWithContext(ctx: DescriptorContext,): Promise<T> {
    return run(ctx,);
  }
  return {
    // oxlint-disable-next-line no-thenable -- a thenable is the entire point of TestDescriptor; awaiting drives lazy execution
    then,
    [RUN_WITH_CONTEXT]: runWithContext,
  };
}
