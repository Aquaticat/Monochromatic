// See https://github.com/tc39/proposal-throw-expressions
// eslint-disable prefer-type-error
import { getLogger } from '@logtape/logtape';
import { match } from 'ts-pattern';

const l = getLogger(['m', 'error.throws']);

/* @__NO_SIDE_EFFECTS__ */ export function throws(
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
      l.warn`error.name ${error.name} not one of:
      throwableErrors = ['Error', 'RangeError', 'ReferenceError', 'TypeError', 'URIError']
      This function doesn't handle custom error types.
      Pass in a custom error to throw it.`;

      throw new Error(`${error.name}: ${error.message}`,
        error.cause ? { cause: error.cause } : undefined);
    });
}
