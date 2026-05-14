/**
 * Races a promise against a deadline.
 * Resolves with the promise's value if it settles in time;
 * rejects with a labeled `Error` otherwise.
 *
 * Uses `Promise.race` with a `using`-disposed timer so the
 * `setTimeout` handle is cleared whether the race wins or loses.
 *
 * @param promise - promise to race against the timeout
 *
 * @param ms - timeout duration in milliseconds
 *
 * @param label - human-readable label for the timeout error message
 *
 * @returns same value as the input promise when it settles before the timeout
 *
 * @throws Error when the timeout expires before the promise settles
 *
 * @example
 * ```ts
 * import { withTimeout, } from '\@monochromatic-dev/module-async-time';
 *
 * const data = await withTimeout({
 *   promise: fetch(url,),
 *   ms: 5000,
 *   label: 'fetch user data',
 * },);
 * ```
 */
export async function withTimeout<T,>({
  promise,
  ms,
  label,
}: {
  readonly label: string;
  readonly ms: number;
  readonly promise: Promise<T>;
},): Promise<T> {
  /**
   * setTimeout handle shared between the Promise executor and the `using` disposer.
   *
   * Hoisted to function root because the executor assigns it synchronously
   * inside `new Promise`, while the disposer reads it on every scope-exit path;
   * both branches must reference the same binding.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- timer handle is assigned inside the Promise constructor callback and read by the using-disposer; both branches need a shared mutable binding
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;

  /**
   * Clears the pending setTimeout when the race resolves before the timeout fires.
   *
   * Without this, the timer would still call `reject` after `Promise.race` has
   * already settled, producing an unhandled rejection on a promise no caller awaits.
   */
  using _cleanup = {
    [Symbol.dispose](): void {
      if (timer !== undefined)
        clearTimeout(timer,);
    },
  };

  return await Promise.race([
    promise,
    // oxlint-disable-next-line promise/avoid-new -- Promise.race requires a rejecting promise; no async/await alternative exists
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
