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
  /** Debounced wrapper; each call resets the delay timer. */
  debounced: () => void;
  /** Executes the function immediately and cancels any pending timer. */
  flush: () => void;
  /** Cancels any pending timer without executing the function. */
  cancel: () => void;
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
 */
export function createDebounced(
  {
    fn,
    delayMs,
  }: {
    fn: () => void;
    delayMs: number
  },
): DebouncedHandle {
  let timer = 0;

  /** Executes the function immediately and cancels any pending timer. */
  function flush(): void {
    clearTimeout(timer,);
    timer = 0;
    fn();
  }

  /** Schedules execution after the debounce delay. */
  function debounced(): void {
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded
    timer = globalThis.setTimeout(
      fn,
      delayMs,
    ) as unknown as number;
  }

  /** Cancels any pending timer without executing the function. */
  function cancel(): void {
    clearTimeout(timer,);
    timer = 0;
  }

  return {
    debounced,
    flush,
    cancel,
  };
}
