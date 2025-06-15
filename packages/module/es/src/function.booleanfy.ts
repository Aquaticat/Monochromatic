import type { Promisable } from 'type-fest';
import type { NotPromise } from './promise.type.ts';

/**
 * Transforms a function to return a boolean based on the truthiness of its original return value.
 * This higher-order function creates a new function that preserves the original function's
 * parameter signature while converting its return value to a boolean using JavaScript's
 * truthiness evaluation. Useful for creating predicate functions from existing functions
 * that return various types.
 *
 * @param fn - Original function to transform into a boolean-returning function
 * @returns New function with same parameters but returning boolean based on original result's truthiness
 *
 * @example
 * ```ts
 * // Transform a string length function to a boolean checker
 * const hasLength = booleanfy((str: string) => str.length);
 * hasLength('hello'); // true (5 is truthy)
 * hasLength(''); // false (0 is falsy)
 *
 * // Transform a number function to boolean
 * const isPositive = booleanfy((n: number) => n > 0 ? n : 0);
 * isPositive(5); // true (5 is truthy)
 * isPositive(-3); // false (0 is falsy)
 *
 * // Transform an object getter to existence checker
 * const hasProperty = booleanfy((obj: any, key: string) => obj[key]);
 * hasProperty({ a: 1 }, 'a'); // true (1 is truthy)
 * hasProperty({ a: 1 }, 'b'); // false (undefined is falsy)
 *
 * // Transform array methods
 * const hasElements = booleanfy((arr: any[]) => arr.length);
 * hasElements([1, 2, 3]); // true
 * hasElements([]); // false
 * ```
 */
export function booleanfy<Args extends any[], ReturnType,>(
  fn: (...args: Args) => ReturnType,
): (...args: Args) => boolean {
  return function booleanfied(...args: Args): boolean {
    const result = fn(...args);
    return Boolean(result);
  };
}

/**
 * Transforms an async function to return a boolean based on the truthiness of its original return value.
 * This is the async version of booleanfy that handles functions returning promises or promisable values.
 * The resulting function awaits the original function's result before converting it to a boolean.
 *
 * @param fn - Original async function to transform into a boolean-returning function
 * @returns New async function with same parameters but returning Promise<boolean> based on original result's truthiness
 *
 * @example
 * ```ts
 * // Transform an async API call to boolean checker
 * const userExists = booleanfyAsync(async (id: string) => {
 *   const user = await fetchUser(id);
 *   return user; // Will be truthy if user exists, falsy if null/undefined
 * });
 * await userExists('123'); // true if user found, false otherwise
 *
 * // Transform async file operations
 * const fileExists = booleanfyAsync(async (path: string) => {
 *   try {
 *     return await fs.stat(path);
 *   } catch {
 *     return null;
 *   }
 * });
 * await fileExists('./package.json'); // true if file exists
 *
 * // Transform async validation
 * const isValidEmail = booleanfyAsync(async (email: string) => {
 *   const result = await validateEmail(email);
 *   return result.isValid ? result : null;
 * });
 * await isValidEmail('test@example.com'); // true if valid
 * ```
 */
export function booleanfyAsync<Args extends any[], ReturnType extends NotPromise,>(
  fn: (...args: Args) => Promisable<ReturnType>,
): (...args: Args) => Promise<boolean> {
  return async function booleanfied(...args: Args): Promise<boolean> {
    const result = await fn(...args);
    return Boolean(result);
  };
}
