import type {
  $ as Is,
} from '@_/types/t function/t is/t/r s/p p/index.ts';

//region General String Types -- General utility string types

//endregion General String Types

/**
 * Type guard that checks if a value is a string type using JavaScript typeof operator.
 * This function provides precise type narrowing for string types and is essential for
 * type-safe string operations in TypeScript applications.
 *
 * @param value - Value to test for string type
 * @returns True if value is a string, false otherwise
 * @example
 * ```ts
 * const input: unknown = "hello";
 * if (isString(input)) {
 *   // input is now typed as string
 *   console.log(input.toUpperCase()); // "HELLO"
 * }
 *
 * isString("text"); // true
 * isString(123); // false
 * isString(null); // false
 * ```
 */
export function $(value: unknown,): value is string {
  return typeof value === 'string';
}

const _$: Is = $;
