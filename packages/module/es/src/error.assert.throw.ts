import type { Promisable } from 'type-fest';
import { equalsOrThrow } from './function.equals.ts';
import { logtapeGetLogger } from './logtape.shared.ts';
import type { NotPromise } from './promise.type.ts';

//region Error Assertion Testing -- Provides comprehensive utilities for asserting that functions throw expected errors in both sync and async contexts

const l = logtapeGetLogger(['m', 'error.assert.throw']);

/**
 * Expected error types that can be used for error assertion testing.
 * Supports error class names as strings, specific Error instances, or custom error messages.
 * This type union enables flexible error matching strategies for comprehensive test scenarios.
 *
 * @example
 * ```ts
 * // Error class names
 * const errorType1: ExpectedError = 'TypeError';
 * const errorType2: ExpectedError = 'RangeError';
 *
 * // Specific Error instances
 * const customError: ExpectedError = new Error('Custom message');
 *
 * // Custom error message strings
 * const errorMessage: ExpectedError = 'Invalid input provided';
 * ```
 */
type ExpectedError =
  | 'TypeError'
  | 'RangeError'
  | 'ReferenceError'
  | 'URIError'
  | string & {}
  | Error;

/**
 * Asserts that a function throws a specific error in async contexts.
 * This function executes the provided function and verifies that it throws an error
 * matching the expected error type, instance, or message. Supports various error
 * matching strategies including error class names, specific Error instances, and custom messages.
 *
 * @param error - Expected error specification. Can be:
 *   - Error class name ('TypeError', 'RangeError', etc.)
 *   - Specific Error instance for exact matching
 *   - Custom error message string
 *   - Function that returns an Error for dynamic error creation
 * @param fn - Function to execute that should throw an error
 * @throws {Error} When the function doesn't throw or throws an unexpected error
 *
 * @example
 * ```ts
 * // Test for specific error types
 * await assertThrowAsync('TypeError', () => someInvalidOperation());
 * await assertThrowAsync('RangeError', () => arrayAccess(-1));
 *
 * // Test for specific error instances
 * const expectedError = new Error('Custom message');
 * await assertThrowAsync(expectedError, () => throwCustomError());
 *
 * // Test for custom error messages
 * await assertThrowAsync('Invalid input', () => validateInput('bad'));
 *
 * // Dynamic error creation
 * await assertThrowAsync(() => new Error('Dynamic'), () => dynamicThrow());
 * ```
 */
export async function assertThrowAsync(
  error:
    | 'TypeError'
    | 'RangeError'
    | 'ReferenceError'
    | 'URIError'
    | string & {}
    | Error
    | (() => Promisable<Error>),
  fn: () => Promisable<any>,
): Promise<void> {
  try {
    await fn();
  } catch (actualError: any) {
    l.debug`assertThrowAsync(error: ${error}, fn: ${String(fn)}), actualError: ${
      String(actualError)
    }`;

    const expectedError = typeof error === 'function' ? await error() : error;

    const equalErrorOrThrow = equalsOrThrow(expectedError);

    if (expectedError instanceof Error) {
      equalErrorOrThrow(actualError);
      return;
    }

    /* v8 ignore next 3 -- @preserve */
    if (typeof expectedError !== 'string') {
      throw new Error(`unexpected type ${typeof error} of expected error: ${error}`);
    }

    // Accept any instance of Error
    if (expectedError === 'Error') {
      if (!(actualError instanceof Error)) {
        throw new Error(`actualError ${actualError} is not an Error`);
      }
      return;
    }

    if (expectedError.endsWith('Error')) {
      // MAYBE: Error.name isn't working? Find all the other instances where this was used
      //        and replace it with Object.prototype.toString.call as usual
      equalErrorOrThrow(actualError?.name);
      return;
    }

    equalErrorOrThrow(actualError.message);
    return;
  }

  throw new Error(`fn ${fn} unexpectedly didn't throw`);
}

/**
 * Asserts that a function throws a specific error in synchronous contexts.
 * This function executes the provided function and verifies that it throws an error
 * matching the expected error type, instance, or message. Core synchronous version
 * of error throwing assertions.
 *
 * @param error - Expected error specification. Can be:
 *   - Error class name ('TypeError', 'RangeError', etc.)
 *   - Specific Error instance for exact matching
 *   - Custom error message string
 *   - Function that returns an Error for dynamic error creation
 * @param fn - Function to execute that should throw an error
 * @throws {Error} When the function doesn't throw or throws an unexpected error
 *
 * @example
 * ```ts
 * // Test for specific error types
 * assertThrow('TypeError', () => someInvalidOperation());
 * assertThrow('RangeError', () => arrayAccess(-1));
 *
 * // Test for specific error instances
 * const expectedError = new Error('Custom message');
 * assertThrow(expectedError, () => throwCustomError());
 *
 * // Test for custom error messages
 * assertThrow('Invalid input', () => validateInput('bad'));
 *
 * // Dynamic error creation
 * assertThrow(() => new Error('Dynamic'), () => dynamicThrow());
 * ```
 */
export function assertThrow(
  error:
    | 'TypeError'
    | 'RangeError'
    | 'ReferenceError'
    | 'URIError'
    | string & {}
    | Error
    | (() => Error),
  fn: () => NotPromise,
): void {
  try {
    fn();
  } catch (actualError: any) {
    l.debug`assertThrow(error: ${error}, fn: ${String(fn)}), actualError: ${
      String(actualError)
    }`;

    const expectedError = typeof error === 'function' ? error() : error;

    const equalErrorOrThrow = equalsOrThrow(expectedError);

    if (expectedError instanceof Error) {
      equalErrorOrThrow(actualError);
      return;
    }

    /* v8 ignore next 3 -- @preserve */
    if (typeof expectedError !== 'string') {
      throw new Error(`unexpected type ${typeof error} of expected error: ${error}`);
    }

    // Accept any instance of Error
    if (expectedError === 'Error') {
      if (!(actualError instanceof Error)) {
        throw new Error(`actualError ${actualError} is not an Error`);
      }
      return;
    }

    if (expectedError.endsWith('Error')) {
      // MAYBE: Error.name isn't working? Find all the other instances where this was used
      //        and replace it with Object.prototype.toString.call as usual
      equalErrorOrThrow(actualError?.name);
      return;
    }
    equalErrorOrThrow(actualError.message);
    return;
  }

  throw new Error(`fn ${fn} unexpectedly didn't throw`);
}

/**
 * Asserts that a function throws any Error instance in async contexts.
 * Convenience function that tests for any Error subclass without checking the specific type.
 *
 * @param fn - Function to execute that should throw an Error
 * @throws {Error} When the function doesn't throw or throws a non-Error value
 *
 * @example
 * ```ts
 * await assertThrowErrorAsync(() => Promise.reject(new TypeError('Any error')));
 * await assertThrowErrorAsync(() => riskyAsyncOperation());
 * await assertThrowErrorAsync(() => { throw new Error('Generic error'); });
 * ```
 */
export async function assertThrowErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('Error', fn);
}

/**
 * Asserts that a function throws a TypeError in async contexts.
 * Convenience function for testing type-related errors in async operations.
 *
 * @param fn - Function to execute that should throw a TypeError
 * @throws {Error} When the function doesn't throw or throws a different error type
 *
 * @example
 * ```ts
 * await assertThrowTypeErrorAsync(() => callMethodOnNull());
 * await assertThrowTypeErrorAsync(() => Promise.resolve(null).property);
 * await assertThrowTypeErrorAsync(() => invalidTypeConversion());
 * ```
 */
export async function assertThrowTypeErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('TypeError', fn);
}

/**
 * Asserts that a function throws a RangeError in async contexts.
 * Convenience function for testing range and boundary-related errors in async operations.
 *
 * @param fn - Function to execute that should throw a RangeError
 * @throws {Error} When the function doesn't throw or throws a different error type
 *
 * @example
 * ```ts
 * await assertThrowRangeErrorAsync(() => new Array(-1));
 * await assertThrowRangeErrorAsync(() => arrayAccess(outOfBoundsIndex));
 * await assertThrowRangeErrorAsync(() => invalidNumericRange());
 * ```
 */
export async function assertThrowRangeErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('RangeError', fn);
}

/**
 * Asserts that a function throws a ReferenceError in async contexts.
 * Convenience function for testing reference and variable access errors in async operations.
 *
 * @param fn - Function to execute that should throw a ReferenceError
 * @throws {Error} When the function doesn't throw or throws a different error type
 *
 * @example
 * ```ts
 * await assertThrowReferenceErrorAsync(() => accessUndefinedVariable());
 * await assertThrowReferenceErrorAsync(() => referenceNonExistentFunction());
 * await assertThrowReferenceErrorAsync(() => strictModeViolation());
 * ```
 */
export async function assertThrowReferenceErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('ReferenceError', fn);
}

/**
 * Asserts that a function throws a URIError in async contexts.
 * Convenience function for testing URI encoding/decoding errors in async operations.
 *
 * @param fn - Function to execute that should throw a URIError
 * @throws {Error} When the function doesn't throw or throws a different error type
 *
 * @example
 * ```ts
 * await assertThrowURIErrorAsync(() => decodeURIComponent('%'));
 * await assertThrowURIErrorAsync(() => invalidUriOperation());
 * await assertThrowURIErrorAsync(() => malformedUriHandling());
 * ```
 */
export async function assertThrowURIErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('URIError', fn);
}

/**
 * Asserts that a function throws any Error instance.
 * Convenience function that tests for any Error subclass without checking the specific type.
 *
 * @param fn - Function to execute that should throw an Error
 * @throws {Error} When the function doesn't throw or throws a non-Error value
 *
 * @example
 * ```ts
 * assertThrowError(() => { throw new TypeError('Any error'); });
 * assertThrowError(() => riskyOperation());
 * assertThrowError(() => { throw new Error('Generic error'); });
 * ```
 */
export function assertThrowError(fn: () => NotPromise): void {
  assertThrow('Error', fn);
}

/**
 * Asserts that a function throws a TypeError.
 * Convenience function for testing type-related errors in synchronous operations.
 *
 * @param fn - Function to execute that should throw a TypeError
 * @throws {Error} When the function doesn't throw or throws a different error type
 *
 * @example
 * ```ts
 * assertThrowTypeError(() => null.property);
 * assertThrowTypeError(() => callMethodOnUndefined());
 * assertThrowTypeError(() => invalidTypeConversion());
 * ```
 */
export function assertThrowTypeError(
  fn: () => NotPromise,
): void {
  assertThrow('TypeError', fn);
}

/**
 * Asserts that a function throws a RangeError.
 * Convenience function for testing range and boundary-related errors in synchronous operations.
 *
 * @param fn - Function to execute that should throw a RangeError
 * @throws {Error} When the function doesn't throw or throws a different error type
 *
 * @example
 * ```ts
 * assertThrowRangeError(() => new Array(-1));
 * assertThrowRangeError(() => arrayAccess(outOfBoundsIndex));
 * assertThrowRangeError(() => invalidNumericRange());
 * ```
 */
export function assertThrowRangeError(
  fn: () => NotPromise,
): void {
  assertThrow('RangeError', fn);
}

/**
 * Asserts that a function throws a ReferenceError.
 * Convenience function for testing reference and variable access errors in synchronous operations.
 *
 * @param fn - Function to execute that should throw a ReferenceError
 * @throws {Error} When the function doesn't throw or throws a different error type
 *
 * @example
 * ```ts
 * assertThrowReferenceError(() => accessUndefinedVariable());
 * assertThrowReferenceError(() => referenceNonExistentFunction());
 * assertThrowReferenceError(() => strictModeViolation());
 * ```
 */
export function assertThrowReferenceError(
  fn: () => NotPromise,
): void {
  assertThrow('ReferenceError', fn);
}

/**
 * Asserts that a function throws a URIError.
 * Convenience function for testing URI encoding/decoding errors in synchronous operations.
 *
 * @param fn - Function to execute that should throw a URIError
 * @throws {Error} When the function doesn't throw or throws a different error type
 *
 * @example
 * ```ts
 * assertThrowURIError(() => decodeURIComponent('%'));
 * assertThrowURIError(() => invalidUriOperation());
 * assertThrowURIError(() => malformedUriHandling());
 * ```
 */
export function assertThrowURIError(
  fn: () => NotPromise,
): void {
  assertThrow('URIError', fn);
}

//endregion Error Assertion Testing
