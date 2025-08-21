/**
 * Creates a promise that resolves after a specified delay in milliseconds.
 * Useful for adding delays in async functions, throttling operations, or creating timeouts.
 *
 * The promise resolves with `undefined` after the specified time has elapsed.
 * Uses `setTimeout` internally to create the delay mechanism.
 *
 * @param timeInMs - Time to wait in milliseconds before resolving
 * @returns Promise that resolves to undefined after the specified delay
 *
 * @example
 * ```ts
 * // Basic usage
 * await wait(1000); // Wait for 1 second
 * console.log('1 second has passed');
 *
 * // In an async function
 * async function delayedOperation() {
 *   console.log('Starting...');
 *   await wait(500); // Wait 500ms
 *   console.log('After delay');
 * }
 *
 * // Throttling operations
 * for (let i = 0; i < 5; i++) {
 *   console.log(`Step ${i + 1}`);
 *   await wait(200); // 200ms between each step
 * }
 * ```
 */
export function wait(timeInMs: number,): Promise<undefined> {
  // eslint-disable avoid-new
  return new Promise(function createTimeout(resolve,) {
    return setTimeout(resolve, timeInMs,);
  },);
}
