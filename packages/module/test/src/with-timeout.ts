/**
 * Wraps a promise with a timeout that rejects if the promise
 * does not settle within the specified duration.
 *
 * @param promise - Promise to race against the timeout
 *
 * @param ms - Timeout duration in milliseconds
 *
 * @param label - Human-readable label for the timeout error message
 *
 * @returns same value as the input promise if it settles in time
 *
 * @throws Error when the timeout expires before the promise settles
 *
 * @example
 * ```ts
 * await withTimeout(fetch(url), 5000, 'fetch user data');
 * ```
 */
export async function withTimeout<T>({
  promise,
  ms,
  label,
}: {
  label: string;
  ms: number;
  promise: Promise<T>;
}): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;

  using _cleanup = {
    [Symbol.dispose](): void {
      if (timer !== undefined) {
        clearTimeout(timer,);
      }
    },
  };

  return await Promise.race([
    promise,
    // oxlint-disable-next-line avoid-new -- Promise.race requires a rejecting promise; no async/await alternative exists
    new Promise<never>(function rejectAfterTimeout(
      _resolve,
      reject,
    ) {
      timer = setTimeout(
        function onTimeout() {
          reject(new Error(`Timed out after ${String(ms,)}ms: ${label}`,),);
        },
        ms,
      );
    },),
  ],);
}
