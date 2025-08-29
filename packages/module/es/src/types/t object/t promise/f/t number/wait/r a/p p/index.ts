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
 * Basic usage:
 * ```ts
 * await $(1000); // Wait for 1 second
 * console.log('1 second has passed');
 * ```
 *
 * @example
 * In an async function:
 * ```ts
 * async function delayedOperation() {
 *   console.log('Starting...');
 *   await $(500); // Wait 500ms
 *   console.log('After delay');
 * }
 * ```
 *
 * @example
 * Throttling operations:
 * ```ts
 * for (let i = 0; i < 5; i++) {
 *   console.log(`Step ${i + 1}`);
 *   await $(200); // 200ms between each step
 * }
 * ```
 *
 * @example
 * Creating timeouts in async workflows:
 * ```ts
 * async function fetchWithDelay() {
 *   const result = await Promise.race([
 *     fetch('/api/data'),
 *     $(5000).then(() => { throw new Error('Timeout'); })
 *   ]);
 *   return result;
 * }
 * ```
 *
 * @example
 * Simulating async operations in tests:
 * ```ts
 * async function simulateSlowOperation() {
 *   await $(100); // Simulate processing time
 *   return { success: true, data: 'processed' };
 * }
 * ```
 *
 * @example
 * Debouncing user interactions:
 * ```ts
 * let debounceTimeout: NodeJS.Timeout | null = null;
 * 
 * async function debounceAction(action: () => void) {
 *   if (debounceTimeout) clearTimeout(debounceTimeout);
 *   await $(300); // Wait 300ms
 *   action();
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $(timeInMs: number): Promise<undefined> {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Promise constructor pattern
  return new Promise(function createTimeout(resolve) {
    return setTimeout(resolve, timeInMs);
  });
}