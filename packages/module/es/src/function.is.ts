import type { Promisable } from 'type-fest';

// MAYBE: Doesn't correctly infer function type.
// Searching "typescript function is async predicate" yields nothing.

/**
 * Type guard that checks if a function is an `AsyncFunction`.
 *
 * @remarks
 * This function uses the constructor name to determine if the function is asynchronous.
 * This may not be reliable in all JavaScript environments or with certain bundler configurations.
 *
 * @template T_fnReturnUnwrapped - Return type of the unwrapped promise.
 * @template T_inputs - Input arguments for the function.
 * @param fn - Function to check.
 * @returns `true` if `fn` is an `AsyncFunction`, otherwise `false`.
 * @example
 * ```ts
 * import { isAsyncFunction } from '@monochromatic-dev/module-es';
 *
 * async function myAsyncFn(): Promise<string> {
 *   return 'hello';
 * }
 *
 * function mySyncFn(): string {
 *   return 'world';
 * }
 *
 * if (isAsyncFunction(myAsyncFn)) {
 *   // myAsyncFn is inferred as (...inputs: any[]) => Promise<string>
 *   const result = await myAsyncFn();
 * }
 *
 * console.log(isAsyncFunction(mySyncFn)); // false
 * ```
 */
export function isAsyncFunction<
  T_fnReturnUnwrapped,
  T_inputs extends readonly unknown[],
>(
  fn: (...inputs: T_inputs) => Promisable<T_fnReturnUnwrapped>,
): fn is (...inputs: T_inputs) => Promise<T_fnReturnUnwrapped> {
  return fn.constructor.name === 'AsyncFunction';
}

/**
 * Type guard that checks if a function is a synchronous `Function`.
 *
 * @remarks
 * This function uses the constructor name to determine if the function is synchronous.
 * This may not be reliable in all JavaScript environments.
 *
 * @template T_fnReturnUnwrapped - Return type of the function.
 * @template T_inputs - Input arguments for the function.
 * @param fn - Function to check.
 * @returns `true` if `fn` is a synchronous `Function`, otherwise `false`.
 * @example
 * ```ts
 * import { isSyncFunction } from '@monochromatic-dev/module-es';
 *
 * async function myAsyncFn(): Promise<string> {
 *   return 'hello';
 * }
 *
 * function mySyncFn(): string {
 *   return 'world';
 * }
 *
 * if (isSyncFunction(mySyncFn)) {
 *   // mySyncFn is inferred as (...inputs: any[]) => string
 *   const result = mySyncFn();
 * }
 *
 * console.log(isSyncFunction(myAsyncFn)); // false
 * ```
 */
export function isSyncFunction<
  T_fnReturnUnwrapped,
  T_inputs extends readonly unknown[],
>(
  fn: (...inputs: T_inputs) => Promisable<T_fnReturnUnwrapped>,
): fn is (...inputs: T_inputs) => T_fnReturnUnwrapped {
  return fn.constructor.name === 'Function';
}

/**
 * A function that performs no operation.
 * Useful as a default value for callbacks.
 *
 * @example
 * ```ts
 * import { emptyFunction } from '@monochromatic-dev/module-es';
 *
 * function doSomething(callback: () => void = emptyFunction) {
 *   callback();
 * }
 *
 * doSomething(); // Does nothing.
 * ```
 */
export function emptyFunction(): void {
  // No-op
}

/**
 * An asynchronous function that performs no operation and resolves immediately.
 * Useful as a default value for async callbacks.
 *
 * @example
 * ```ts
 * import { emptyFunctionAsync } from '@monochromatic-dev/module-es';
 *
 * async function doSomethingAsync(callback: () => Promise<void> = emptyFunctionAsync) {
 *   await callback();
 * }
 *
 * await doSomethingAsync(); // Does nothing.
 * ```
 */
export async function emptyFunctionAsync(): Promise<void> {
  // No-op
}
