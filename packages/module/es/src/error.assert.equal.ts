import {
  equalsAsyncOrThrow,
  equalsOrThrow,
} from './function.equals.ts';
import type { NotPromise } from './promise.type.ts';

// It's not necessary to be so pedantic as to postfix every assert with Equal when equal is implied.

/**
 * Asserts that two values are equal using deep equality comparison for async contexts.
 * This function compares the expected and actual values and throws an error if they aren't equal.
 * Supports async values and provides detailed error messages on assertion failure.
 *
 * @param expected - Expected value to compare against
 * @param actual - Actual value to compare
 * @throws {Error} When the values aren't equal
 *
 * @example
 * ```ts
 * await assertAsync(42, getValue()); // Passes if getValue() returns 42
 * await assertAsync([1, 2, 3], getArray()); // Deep equality check for arrays
 * await assertAsync({ a: 1 }, getObject()); // Deep equality check for objects
 *
 * // Will throw if values don't match
 * await assertAsync('expected', 'actual'); // Throws: values not equal
 * ```
 */
export async function assertAsync(expected: any, actual: any): Promise<void> {
  await equalsAsyncOrThrow(expected)(actual);
}

/**
 * Asserts that a value is true in async contexts.
 * Convenience function that compares the actual value against boolean true.
 *
 * @param actual - Value to check for truthiness (exactly true, not just truthy)
 * @throws {Error} When the value isn't exactly true
 *
 * @example
 * ```ts
 * await assertTrueAsync(Promise.resolve(true)); // Passes
 * await assertTrueAsync(isValid()); // Passes if isValid() returns true
 * await assertTrueAsync(1); // Throws - truthy but not true
 * await assertTrueAsync('true'); // Throws - string, not boolean
 * ```
 */
export async function assertTrueAsync(
  actual: any,
): Promise<void> {
  await assertAsync(true, await actual);
}

/**
 * Asserts that a value is false in async contexts.
 * Convenience function that compares the actual value against boolean false.
 *
 * @param actual - Value to check for exact false value
 * @throws {Error} When the value isn't exactly false
 *
 * @example
 * ```ts
 * await assertFalseAsync(Promise.resolve(false)); // Passes
 * await assertFalseAsync(isInvalid()); // Passes if isInvalid() returns false
 * await assertFalseAsync(0); // Throws - falsy but not false
 * await assertFalseAsync(null); // Throws - falsy but not false
 * ```
 */
export async function assertFalseAsync(
  actual: any,
): Promise<void> {
  await assertAsync(false, await actual);
}

/**
 * Asserts that a value is undefined in async contexts.
 * Convenience function that compares the actual value against undefined.
 *
 * @param actual - Value to check for undefined
 * @throws {Error} When the value isn't undefined
 *
 * @example
 * ```ts
 * await assertUndefinedAsync(Promise.resolve(undefined)); // Passes
 * await assertUndefinedAsync(getValue()); // Passes if getValue() returns undefined
 * await assertUndefinedAsync(null); // Throws - null isn't undefined
 * await assertUndefinedAsync(0); // Throws - 0 isn't undefined
 * ```
 */
export async function assertUndefinedAsync(
  actual: any,
): Promise<void> {
  await assertAsync(undefined, actual);
}

/**
 * Asserts that a value is null in async contexts.
 * Convenience function that compares the actual value against null.
 *
 * @param actual - Value to check for null
 * @throws {Error} When the value isn't null
 *
 * @example
 * ```ts
 * await assertNullAsync(Promise.resolve(null)); // Passes
 * await assertNullAsync(getValue()); // Passes if getValue() returns null
 * await assertNullAsync(undefined); // Throws - undefined isn't null
 * await assertNullAsync(0); // Throws - 0 isn't null
 * ```
 */
export async function assertNullAsync(
  actual: any,
): Promise<void> {
  await assertAsync(null, actual);
}

/**
 * Asserts that a value is an empty array in async contexts.
 * Convenience function that compares the actual value against an empty array [].
 *
 * @param actual - Value to check for empty array
 * @throws {Error} When the value isn't an empty array
 *
 * @example
 * ```ts
 * await assertEmptyArrayAsync(Promise.resolve([])); // Passes
 * await assertEmptyArrayAsync(getArray()); // Passes if getArray() returns []
 * await assertEmptyArrayAsync([1, 2, 3]); // Throws - not empty
 * await assertEmptyArrayAsync(null); // Throws - not an array
 * ```
 */
export async function assertEmptyArrayAsync(
  actual: any,
): Promise<void> {
  await assertAsync([], actual);
}

/**
 * Asserts that a value is an empty object in async contexts.
 * Convenience function that compares the actual value against an empty object {}.
 *
 * @param actual - Value to check for empty object
 * @throws {Error} When the value isn't an empty object
 *
 * @example
 * ```ts
 * await assertEmptyObjectAsync(Promise.resolve({})); // Passes
 * await assertEmptyObjectAsync(getObject()); // Passes if getObject() returns {}
 * await assertEmptyObjectAsync({ a: 1 }); // Throws - not empty
 * await assertEmptyObjectAsync([]); // Throws - array, not object
 * ```
 */
export async function assertEmptyObjectAsync(
  actual: any,
): Promise<void> {
  await assertAsync({}, actual);
}

/**
 * Asserts that a value is zero in async contexts.
 * Convenience function that compares the actual value against 0.
 *
 * @param actual - Value to check for zero
 * @throws {Error} When the value isn't zero
 *
 * @example
 * ```ts
 * await assert0Async(Promise.resolve(0)); // Passes
 * await assert0Async(Math.floor(0.9)); // Passes
 * await assert0Async(-0); // Passes - negative zero equals zero
 * await assert0Async(false); // Throws - boolean false isn't 0
 * ```
 */
export async function assert0Async(
  actual: any,
): Promise<void> {
  await assertAsync(0, actual);
}

/**
 * Asserts that a value is one in async contexts.
 * Convenience function that compares the actual value against 1.
 *
 * @param actual - Value to check for one
 * @throws {Error} When the value isn't one
 *
 * @example
 * ```ts
 * await assert1Async(Promise.resolve(1)); // Passes
 * await assert1Async(Math.floor(1.9)); // Passes
 * await assert1Async(true); // Throws - boolean true isn't 1
 * await assert1Async('1'); // Throws - string '1' isn't number 1
 * ```
 */
export async function assert1Async(
  actual: any,
): Promise<void> {
  await assertAsync(1, actual);
}

/**
 * Asserts that a value is NaN in async contexts.
 * Convenience function that compares the actual value against Number.NaN.
 *
 * @param actual - Value to check for NaN
 * @throws {Error} When the value isn't NaN
 *
 * @example
 * ```ts
 * await assertNanAsync(Promise.resolve(NaN)); // Passes
 * await assertNanAsync(Number.NaN); // Passes
 * await assertNanAsync(0 / 0); // Passes
 * await assertNanAsync(undefined); // Throws - undefined isn't NaN
 * ```
 */
export async function assertNanAsync(
  actual: any,
): Promise<void> {
  await assertAsync(Number.NaN, actual);
}

/**
 * Asserts that a value is negative one in async contexts.
 * Convenience function that compares the actual value against -1.
 *
 * @param actual - Value to check for negative one
 * @throws {Error} When the value isn't -1
 *
 * @example
 * ```ts
 * await assertNegative1Async(Promise.resolve(-1)); // Passes
 * await assertNegative1Async(Math.floor(-1.9)); // Passes
 * await assertNegative1Async(1); // Throws - positive 1 isn't -1
 * await assertNegative1Async('-1'); // Throws - string '-1' isn't number -1
 * ```
 */
export async function assertNegative1Async(
  actual: any,
): Promise<void> {
  await assertAsync(-1, actual);
}

/**
 * Asserts that two values are equal using deep equality comparison.
 * This function compares the expected and actual values and throws an error if they aren't equal.
 * Core assertion function for synchronous contexts.
 *
 * @param expected - Expected value to compare against
 * @param actual - Actual value to compare
 * @throws {Error} When the values aren't equal
 *
 * @example
 * ```ts
 * assert(42, getValue()); // Passes if getValue() returns 42
 * assert([1, 2, 3], getArray()); // Deep equality check for arrays
 * assert({ a: 1 }, getObject()); // Deep equality check for objects
 *
 * // Will throw if values don't match
 * assert('expected', 'actual'); // Throws: values not equal
 * ```
 */
// Side effect: throws.
export function assert(expected: NotPromise, actual: NotPromise): void {
  equalsOrThrow(expected)(actual);
}

/**
 * Asserts that a value is true.
 * Convenience function that compares the actual value against boolean true.
 *
 * @param actual - Value to check for truthiness (exactly true, not just truthy)
 * @throws {Error} When the value isn't exactly true
 *
 * @example
 * ```ts
 * assertTrue(true); // Passes
 * assertTrue(isValid()); // Passes if isValid() returns true
 * assertTrue(1); // Throws - truthy but not true
 * assertTrue('true'); // Throws - string, not boolean
 * ```
 */
export function assertTrue(actual: NotPromise): void {
  assert(true, actual);
}

/**
 * Asserts that a value is false.
 * Convenience function that compares the actual value against boolean false.
 *
 * @param actual - Value to check for exact false value
 * @throws {Error} When the value isn't exactly false
 *
 * @example
 * ```ts
 * assertFalse(false); // Passes
 * assertFalse(isInvalid()); // Passes if isInvalid() returns false
 * assertFalse(0); // Throws - falsy but not false
 * assertFalse(null); // Throws - falsy but not false
 * ```
 */
export function assertFalse(actual: NotPromise): void {
  assert(false, actual);
}

/**
 * Asserts that a value is undefined.
 * Convenience function that compares the actual value against undefined.
 *
 * @param actual - Value to check for undefined
 * @throws {Error} When the value isn't undefined
 *
 * @example
 * ```ts
 * assertUndefined(undefined); // Passes
 * assertUndefined(getValue()); // Passes if getValue() returns undefined
 * assertUndefined(null); // Throws - null isn't undefined
 * assertUndefined(0); // Throws - 0 isn't undefined
 * ```
 */
export function assertUndefined(actual: NotPromise): void {
  assert(undefined, actual);
}

/**
 * Asserts that a value is null.
 * Convenience function that compares the actual value against null.
 *
 * @param actual - Value to check for null
 * @throws {Error} When the value isn't null
 *
 * @example
 * ```ts
 * assertNull(null); // Passes
 * assertNull(getValue()); // Passes if getValue() returns null
 * assertNull(undefined); // Throws - undefined isn't null
 * assertNull(0); // Throws - 0 isn't null
 * ```
 */
export function assertNull(actual: NotPromise): void {
  assert(null, actual);
}

/**
 * Asserts that a value is an empty array.
 * Convenience function that compares the actual value against an empty array [].
 *
 * @param actual - Value to check for empty array
 * @throws {Error} When the value isn't an empty array
 *
 * @example
 * ```ts
 * assertEmptyArray([]); // Passes
 * assertEmptyArray(getArray()); // Passes if getArray() returns []
 * assertEmptyArray([1, 2, 3]); // Throws - not empty
 * assertEmptyArray(null); // Throws - not an array
 * ```
 */
export function assertEmptyArray(actual: NotPromise): void {
  assert([], actual);
}

/**
 * Asserts that a value is an empty object.
 * Convenience function that compares the actual value against an empty object {}.
 *
 * @param actual - Value to check for empty object
 * @throws {Error} When the value isn't an empty object
 *
 * @example
 * ```ts
 * assertEmptyObject({}); // Passes
 * assertEmptyObject(getObject()); // Passes if getObject() returns {}
 * assertEmptyObject({ a: 1 }); // Throws - not empty
 * assertEmptyObject([]); // Throws - array, not object
 * ```
 */
export function assertEmptyObject(actual: NotPromise): void {
  assert({}, actual);
}

/**
 * Asserts that a value is zero.
 * Convenience function that compares the actual value against 0.
 *
 * @param actual - Value to check for zero
 * @throws {Error} When the value isn't zero
 *
 * @example
 * ```ts
 * assert0(0); // Passes
 * assert0(Math.floor(0.9)); // Passes
 * assert0(-0); // Passes - negative zero equals zero
 * assert0(false); // Throws - boolean false isn't 0
 * ```
 */
export function assert0(actual: NotPromise): void {
  assert(0, actual);
}

/**
 * Asserts that a value is one.
 * Convenience function that compares the actual value against 1.
 *
 * @param actual - Value to check for one
 * @throws {Error} When the value isn't one
 *
 * @example
 * ```ts
 * assert1(1); // Passes
 * assert1(Math.floor(1.9)); // Passes
 * assert1(true); // Throws - boolean true isn't 1
 * assert1('1'); // Throws - string '1' isn't number 1
 * ```
 */
export function assert1(actual: NotPromise): void {
  assert(1, actual);
}

/**
 * Asserts that a value is NaN.
 * Convenience function that compares the actual value against Number.NaN.
 *
 * @param actual - Value to check for NaN
 * @throws {Error} When the value isn't NaN
 *
 * @example
 * ```ts
 * assertNan(NaN); // Passes
 * assertNan(Number.NaN); // Passes
 * assertNan(0 / 0); // Passes
 * assertNan(undefined); // Throws - undefined isn't NaN
 * ```
 */
export function assertNan(actual: NotPromise): void {
  assert(Number.NaN, actual);
}

/**
 * Asserts that a value is negative one.
 * Convenience function that compares the actual value against -1.
 *
 * @param actual - Value to check for negative one
 * @throws {Error} When the value isn't -1
 *
 * @example
 * ```ts
 * assertNegative1(-1); // Passes
 * assertNegative1(Math.floor(-1.9)); // Passes
 * assertNegative1(1); // Throws - positive 1 isn't -1
 * assertNegative1('-1'); // Throws - string '-1' isn't number -1
 * ```
 */
export function assertNegative1(actual: NotPromise): void {
  assert(-1, actual);
}

export * from './error.assert.equal.type.ts';
