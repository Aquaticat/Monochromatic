/**
 * Debounce utility for the editord client.
 *
 * Creates a debounced wrapper that delays invocation until after
 * a quiet period. Each call resets the timer.
 *
 * @example
 * ```ts
 * const save = createDebounced({ fn: function doSave() { ... }, delayMs: 500, });
 * inputEl.addEventListener('input', save);
 * ```
 */

/**
 * Creates a debounced function that delays invoking `fn` until
 * `delayMs` milliseconds have elapsed since the last call.
 *
 * @param fn - function to debounce
 *
 * @param delayMs - debounce delay in milliseconds
 *
 * @returns debounced wrapper
 */
export function createDebounced(
  { fn, delayMs, }: { fn: () => void; delayMs: number; },
): () => void {
  let timer = 0;
  return function debounced(): void {
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded
    timer = globalThis.setTimeout(fn, delayMs,) as unknown as number;
  };
}
