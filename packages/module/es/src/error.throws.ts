//region Error Throwing Utilities -- Provides a utility function for throwing errors with flexible input formats and pattern matching

// See https://github.com/tc39/proposal-throw-expressions
// eslint-disable prefer-type-error
import { getLogger } from '@logtape/logtape';
import { match } from 'ts-pattern';

const l = getLogger(['m', 'error.throws']);

/**
 * Throws an error with flexible input formats, supporting Error instances, strings, or error descriptor objects.
 *
 * This function implements throw expressions functionality inspired by the TC39 proposal, providing
 * a convenient way to throw errors in expression contexts. It supports multiple input formats and
 * uses pattern matching to create appropriate error types based on the error name.
 *
 * @param error - Error to throw, can be an Error instance, string message, or error descriptor object
 * @returns Never returns as this function always throws
 * @throws {Error} Always throws an error - the specific type depends on the input
 * @example
 * ```ts
 * // Throw an existing Error instance
 * throws(new TypeError('Invalid input'));
 *
 * // Throw with a string message
 * throws('Something went wrong');
 *
 * // Throw with error descriptor object
 * throws({
 *   message: 'Value out of range',
 *   name: 'RangeError',
 *   cause: previousError
 * });
 *
 * // Use in expression context
 * const value = input ?? throws('Input is required');
 *
 * // Pattern matching creates appropriate error types
 * throws({ message: 'Type mismatch', name: 'TypeError' }); // Creates TypeError
 * throws({ message: 'Invalid reference', name: 'ReferenceError' }); // Creates ReferenceError
 * ```
 */
export function throws(
  error: Error | string | {
    message: string;
    // MAYBE: Figure out how to support ErrorConstructor here.
    name?: string;
    cause?: any;
  },
): never {
  if (error instanceof Error) {
    throw error;
  }
  if (typeof error === 'string') {
    throw new Error(error);
  }

  if (!error.name) {
    throw new Error(error.message, error.cause ? { cause: error.cause } : undefined);
  }

  return match(error.name)
    .with('Error', function handler() {
      throw new Error(error.message, error.cause ? { cause: error.cause } : undefined);
    })
    .with('RangeError', function handler() {
      throw new RangeError(error.message,
        error.cause ? { cause: error.cause } : undefined);
    })
    .with('ReferenceError', function handler() {
      throw new ReferenceError(error.message,
        error.cause ? { cause: error.cause } : undefined);
    })
    .with('TypeError', function handler() {
      throw new TypeError(error.message,
        error.cause ? { cause: error.cause } : undefined);
    })
    .with('URIError', function handler() {
      throw new URIError(error.message, error.cause ? { cause: error.cause } : undefined);
    })
    .otherwise(function handler() {
      l.info`error.name ${error.name} not one of:
      throwableErrors = ['Error', 'RangeError', 'ReferenceError', 'TypeError', 'URIError']
      This function doesn't handle custom error types.
      Pass in a custom error to throw it.`;

      throw new Error(`${error.name}: ${error.message}`,
        error.cause ? { cause: error.cause } : undefined);
    });
}

//endregion Error Throwing Utilities
