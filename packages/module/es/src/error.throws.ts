// See https://github.com/tc39/proposal-throw-expressions
// eslint-disable prefer-type-error
import { getLogger } from '@logtape/logtape';

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
    if (!error.cause) {
      throw new Error(error.message);
    }
    throw new Error(error.message, { cause: error.cause });
  }

  // TODO: Write my own switch expression
  switch (error.name) {
    case 'Error':
      if (!error.cause) {
        throw new Error(error.message);
      }
      throw new Error(error.message, { cause: error.cause });

    case 'RangeError':
      if (!error.cause) {
        throw new RangeError(error.message);
      }
      throw new RangeError(error.message, { cause: error.cause });

    case 'ReferenceError':
      if (!error.cause) {
        throw new ReferenceError(error.message);
      }
      throw new ReferenceError(error.message, { cause: error.cause });

    case 'TypeError':
      if (!error.cause) {
        throw new TypeError(error.message);
      }
      throw new TypeError(error.message, { cause: error.cause });

    case 'URIError':
      if (!error.cause) {
        throw new URIError(error.message);
      }
      throw new URIError(error.message, { cause: error.cause });

    default:
      l.warn`error.name ${error.name} not one of:
      throwableErrors = ['Error', 'RangeError', 'ReferenceError', 'TypeError', 'URIError']
      This function doesn't handle custom error types.
      Pass in a custom error to throw it.`;

      if (!error.cause) {
        throw new Error(`${error.name}: ${error.message}`);
      }
      throw new Error(`${error.name}: ${error.message}`, { cause: error.cause });
  }
}
