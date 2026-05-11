/**
 * Resolves after a specified delay in milliseconds.
 * Wraps `setTimeout` in a promise.
 *
 * @param ms - delay before the returned promise resolves
 *
 * @returns promise that resolves to `undefined` after `ms` milliseconds
 *
 * @example
 * ```ts
 * import { wait, } from '\@monochromatic-dev/module-async-time';
 *
 * await wait(1000,);
 * ```
 *
 * @example
 * Throttle a loop:
 * ```ts
 * for (const item of items) {
 *   await process(item,);
 *   await wait(200,);
 * }
 * ```
 */
export function wait(ms: number,): Promise<undefined> {
  // oxlint-disable-next-line promise/avoid-new -- Promise constructor pattern
  return new Promise(function createTimeout(resolve,) {
    // oxlint-disable-next-line eslint/no-promise-executor-return -- setTimeout return value intentionally propagated
    return setTimeout(
      resolve,
      ms,
    );
  },);
}
