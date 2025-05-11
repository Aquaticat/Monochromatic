import type { Promisable } from 'type-fest';
import type { NotPromise } from './promise.type.ts';

/**
 * Takes a function and returns a new function that returns a boolean
 * based on the truthiness of the original function's return value.
 *
 * @param fn - The original function to transform
 * @returns A new function with the same parameters but returning a boolean
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
 * {@inheritdoc booleanfy}
 */
export function booleanfyAsync<Args extends any[], ReturnType extends NotPromise,>(
  fn: (...args: Args) => Promisable<ReturnType>,
): (...args: Args) => Promise<boolean> {
  return async function booleanfied(...args: Args): Promise<boolean> {
    const result = await fn(...args);
    return Boolean(result);
  };
}
