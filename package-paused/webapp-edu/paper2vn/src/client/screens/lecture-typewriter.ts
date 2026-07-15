/**
 * Per-character typewriter reveal for the lecture screen.
 *
 * Drives a repeating timer that paints one more character of `text`
 * into `target` per tick. Returns a cancel handle (which immediately
 * fills the remaining text) and a promise that settles on completion
 * or cancellation.
 */

/**
 * Cancels a pending typewriter timer.
 */
export type Cancel = () => void;

/**
 * Minimum per-character interval in milliseconds.
 */
const MIN_INTERVAL_MS = 8;

/**
 * Milliseconds per second, used to convert chars-per-second to interval.
 */
const MS_PER_SECOND = 1_000;

/**
 * Reveals `text` into `target` one character at a time.
 *
 * @param target - element whose `textContent` is mutated each tick
 *
 * @param text - full text to reveal
 *
 * @param charsPerSecond - reveal speed; clamped to a minimum of one tick per 8 ms
 *
 * @returns cancel function and a promise resolved on completion
 *
 * @example
 * ```ts
 * const { cancel, done } = typewrite({
 *   target: dialogueEl,
 *   text: 'Welcome to the lecture.',
 *   charsPerSecond: 40,
 * });
 * await done;
 * ```
 */
export function typewrite(
  {
    target,
    text,
    charsPerSecond,
  }: {
    target: HTMLElement;
    text: string;
    charsPerSecond: number;
  },
): {
  cancel: Cancel;
  done: Promise<void>;
} {
  target.textContent = '';
  /**
   * Per-character delay derived from `charsPerSecond`, floored at 8 ms.
   */
  const interval = Math.max(
    MIN_INTERVAL_MS,
    Math.floor(MS_PER_SECOND / charsPerSecond,),
  );
  /**
   * Mutable runtime state for the typewriter (cancellation, cursor index).
   */
  const state: {
    cancelled: boolean;
    index: number;
  } = {
    cancelled: false,
    index: 0,
  };
  /*
   * `eslint-plugin-promise/avoid-new` flags raw `new Promise` constructors;
   * the typewriter wraps a `setInterval` timer, which has no native promise
   * surface. The promise is created exactly once per call and resolved
   * inside the timer callback when the reveal completes or cancels.
   */
  /* oxlint-disable eslint-plugin-promise/avoid-new -- only way to await setInterval lifecycle; promise is local to this call. */
  /**
   * Promise resolved when the reveal completes or is cancelled.
   */
  const done = new Promise<void>(function run(resolve,): void {
    /**
     * Repeating timer driving the per-character reveal.
     */
    const timer = globalThis.setInterval(
      function step(): void {
        if (state.cancelled) {
          globalThis.clearInterval(timer,);
          resolve();
          return;
        }
        state.index += 1;
        target.textContent = text.slice(
          0,
          state.index,
        );
        if (state.index
          >= text
          .length) {
          globalThis.clearInterval(timer,);
          resolve();
        }
      },
      interval,
    );
  },);
  /* oxlint-enable eslint-plugin-promise/avoid-new */
  return {
    cancel: function cancel(): void {
      if (state.cancelled)
        return;
      state.cancelled = true;
      target.textContent = text;
    },
    done,
  };
}
