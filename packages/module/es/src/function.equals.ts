import {
  equal,
  equalAsync,
} from './any.equal.ts';

/**
 * Creates a function that performs a deep equality comparison between its input and a pre-configured value.
 * This is useful for creating reusable predicate functions.
 *
 * @param equalTo - value to compare against.
 * @returns function that takes a value and returns boolean indicating if it's deeply equal to `equalTo`.
 * @example
 * ```ts
 * import { equals } from '@monochromatic-dev/module-es';
 *
 * const isTwo = equals(2);
 *
 * isTwo(2); // true
 * isTwo(3); // false
 *
 * const isObj = equals({ a: 1 });
 * isObj({ a: 1 }); // true
 * isObj({ a: 2 }); // false
 * ```
 */
export function equals<const T_equalTo,>(
  equalTo: T_equalTo,
): (input: unknown,) => boolean {
  return function inner(input: unknown,): boolean {
    return equal(input, equalTo,);
  };
}

/**
 * Creates a function that performs an asynchronous deep equality comparison between its input and a pre-configured value.
 * This is useful for creating reusable asynchronous predicate functions.
 *
 * @param equalTo - value to compare against.
 * @returns function that takes a value and returns promise resolving to boolean indicating if it's deeply equal to `equalTo`.
 * @example
 * ```ts
 * import { equalsAsync } from '@monochromatic-dev/module-es';
 *
 * const isTwoAsync = equalsAsync(2);
 *
 * await isTwoAsync(2); // true
 * await isTwoAsync(3); // false
 * ```
 */
export function equalsAsync<const T_equalTo,>(
  equalTo: T_equalTo,
): (input: unknown,) => Promise<boolean> {
  return async function inner(input: unknown,): Promise<boolean> {
    return await equalAsync(input, equalTo,);
  };
}

/**
 * Creates a function that checks for deep equality between its input and a given value.
 * If the values are equal, it returns the input value, otherwise it throws an error.
 *
 * @param equalTo - value to compare against.
 * @returns function that takes a value, and returns it if equal to `equalTo`, otherwise throws.
 * @throws {Error} If the input value differs from `equalTo`.
 * @example
 * ```ts
 * import { equalsOrThrow } from '@monochromatic-dev/module-es';
 *
 * const ensureIsTwo = equalsOrThrow(2);
 *
 * ensureIsTwo(2); // returns 2
 *
 * try {
 *   ensureIsTwo(3);
 * } catch (error) {
 *   console.error(error.message); // "input 3 isn't equal to 2"
 * }
 * ```
 */
export function equalsOrThrow<const T_input,>(
  equalTo: unknown,
): (input: T_input,) => T_input {
  return function inner(input: T_input,): T_input {
    if (equal(input, equalTo,))
      return input;

    throw new Error(`input ${input} isn't equal to ${equalTo}`,);
  };
}

/**
 * Creates a function that asynchronously checks for deep equality between its input and a given value.
 * If the values are equal, it returns a promise that resolves with the input value, otherwise it throws an error.
 *
 * @param equalTo - value to compare against.
 * @returns function that takes a value, and returns promise resolving with it if equal to `equalTo`, otherwise throws.
 * @throws {Error} If the input value differs from `equalTo`.
 * @example
 * ```ts
 * import { equalsAsyncOrThrow } from '@monochromatic-dev/module-es';
 *
 * const ensureIsTwoAsync = equalsAsyncOrThrow(2);
 *
 * await ensureIsTwoAsync(2); // resolves with 2
 *
 * try {
 *   await ensureIsTwoAsync(3);
 * } catch (error) {
 *   console.error(error.message); // "input 3 isn't equal to 2"
 * }
 * ```
 */
export function equalsAsyncOrThrow<const T_input,>(
  equalTo: unknown,
): (input: T_input,) => Promise<T_input> {
  return async function inner(input: T_input,): Promise<T_input> {
    if (await equalAsync(input, equalTo,))
      return input;

    throw new Error(`input ${input} isn't equal to ${equalTo}`,);
  };
}
