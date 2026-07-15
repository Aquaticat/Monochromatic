/**
 * Debounce utility for the editord client.
 *
 * Creates a debounced wrapper that delays invocation until after
 * a quiet period. Each call resets the timer.
 *
 * This is the single source of debounce timer logic in editord.
 * Previously `session/debounce.ts` had its own copy of the
 * `clearTimeout` / `setTimeout` / `as unknown as number` dance;
 * that duplication meant the workaround for the Node.js Timeout
 * vs browser number mismatch existed in two places, and any
 * future fix would need to be applied twice. Consolidating here
 * gives every consumer both `debounced` (schedule) and `flush`
 * (execute-now-and-cancel), which `session/debounce.ts` needs
 * for the `beforeunload` path.
 *
 * @example
 * ```ts
 * const { debounced, flush } = createDebounced({ fn: function doSave() { ... }, delayMs: 500, });
 * inputEl.addEventListener('input', debounced);
 * // Force immediate execution and cancel any pending timer:
 * flush();
 * ```
 */

/**
 * Return value of {@link createDebounced}.
 */
export type DebouncedHandle = {
  /**
   * Debounced wrapper; each call resets the delay timer.
   */
  readonly debounced: () => void;
  /**
   * Executes the function immediately and cancels any pending timer.
   */
  readonly flush: () => void;
  /**
   * Cancels any pending timer without executing the function.
   */
  readonly cancel: () => void;
};

/**
 * Creates a debounced function that delays invoking `fn` until
 * `delayMs` milliseconds have elapsed since the last call.
 *
 * @param fn - function to debounce
 *
 * @param delayMs - debounce delay in milliseconds
 *
 * @returns handle with `debounced` wrapper and `flush` for immediate execution
 *
 * @example
 * ```ts
 * const result = createDebounced({ fn: function handleFn() { l.info("done"); }, delayMs: 300, });
 * ```
 */
export function createDebounced(
  {
    fn,
    delayMs,
  }: {
    readonly fn: () => void;
    readonly delayMs: number;
  },
): DebouncedHandle {
  /**
   * Closure-shared state for `flush`, `debounced`, and `cancel`.
   *
   * `state.timer` holds the active `setTimeout` handle or `0` when no timer
   * is pending. Sentinel `0` lets `clearTimeout(state.timer)` stay a safe
   * no-op on first invocation. Held inside an object so the three inner
   * functions can mutate the same reference without a function-root `let`.
   */
  const state = { timer: 0, };

  /**
   * Executes the function immediately and cancels any pending timer.
   */
  function flush(): void {
    clearTimeout(state.timer,);
    state.timer = 0;
    fn();
  }

  /**
   * Schedules execution after the debounce delay.
   */
  function debounced(): void {
    clearTimeout(state.timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded
    state.timer = globalThis.setTimeout(
      fn,
      delayMs,
    ) as unknown as number;
  }

  /**
   * Cancels any pending timer without executing the function.
   */
  function cancel(): void {
    clearTimeout(state.timer,);
    state.timer = 0;
  }

  return {
    debounced,
    flush,
    cancel,
  };
}
