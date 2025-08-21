import type { Result, } from 'happy-rusty';

/**
 * Unwraps a Result type, returning the success value or throwing the error.
 * This function extracts the value from a Result type, handling both success and error cases.
 * For error cases, it enhances the error with additional context and throws it.
 *
 * When the Result contains an error that starts with "NotFoundError:", it automatically
 * adds an ENOENT error code to match Node.js filesystem error conventions.
 *
 * @param result - Result instance to unwrap
 * @returns Success value if Result is Ok
 * @throws Enhanced error with potential ENOENT code if Result is Err
 *
 * @example
 * ```ts
 * import { Ok, Err } from 'happy-rusty';
 *
 * // Success case
 * const successResult = Ok('hello world');
 * const value = unwrapResult(successResult); // 'hello world'
 *
 * // Error case
 * const errorResult = Err(new Error('Something went wrong'));
 * unwrapResult(errorResult); // throws Error: Something went wrong
 *
 * // NotFoundError case with ENOENT code
 * const notFoundResult = Err(new Error('NotFoundError: File not found'));
 * unwrapResult(notFoundResult); // throws Error with code: 'ENOENT'
 * ```
 */
export function unwrapResult<Ok, Err,>(
  result: Result<Ok, Err>,
): Ok {
  if (result.isErr()) {
    const unwrappedResultError = result.unwrapErr() as Error & { code?: string; };
    if (unwrappedResultError.message.startsWith('NotFoundError:',))
      unwrappedResultError.code = 'ENOENT';
    throw unwrappedResultError;
  }
  return result.unwrap();
}
