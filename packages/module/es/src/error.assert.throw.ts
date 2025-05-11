import type { Promisable } from 'type-fest';
import { equalsOrThrow } from './function.equals.ts';
import { logtapeGetLogger } from './logtape.shared.ts';
import type { NotPromise } from './promise.type.ts';

const l = logtapeGetLogger(['m', 'error.assert.throw']);

type ExpectedError =
  | 'TypeError'
  | 'RangeError'
  | 'ReferenceError'
  | 'URIError'
  | string & {}
  | Error;

/* @__NO_SIDE_EFFECTS__ */ export async function assertThrowAsync(
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
      // MAYBE: Error.name isn't working? Find all the other instances I used that
      //        and replace it with Object.prototype.toString.call as usual
      equalErrorOrThrow(actualError?.name);
      return;
    }

    equalErrorOrThrow(actualError.message);
    return;
  }

  throw new Error(`fn ${fn} unexpectedly didn't throw`);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertThrow(
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
      // MAYBE: Error.name isn't working? Find all the other instances I used that
      //        and replace it with Object.prototype.toString.call as usual
      equalErrorOrThrow(actualError?.name);
      return;
    }
    equalErrorOrThrow(actualError.message);
    return;
  }

  throw new Error(`fn ${fn} unexpectedly didn't throw`);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertThrowErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('Error', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertThrowTypeErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('TypeError', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertThrowRangeErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('RangeError', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertThrowReferenceErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('ReferenceError', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export async function assertThrowURIErrorAsync(
  fn: () => Promisable<any>,
): Promise<void> {
  await assertThrowAsync('URIError', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertThrowError(fn: () => NotPromise): void {
  assertThrow('Error', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertThrowTypeError(
  fn: () => NotPromise,
): void {
  assertThrow('TypeError', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertThrowRangeError(
  fn: () => NotPromise,
): void {
  assertThrow('RangeError', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertThrowReferenceError(
  fn: () => NotPromise,
): void {
  assertThrow('ReferenceError', fn);
}

/* @__NO_SIDE_EFFECTS__ */ export function assertThrowURIError(
  fn: () => NotPromise,
): void {
  assertThrow('URIError', fn);
}
