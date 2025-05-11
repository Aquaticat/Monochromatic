import type { Promisable } from 'type-fest';
import type { NotPromise } from './promise.type.ts';

/**
 * Wraps a function to throw an error when it returns a falsy value.
 *
 * @param fn - The original function to wrap
 * @param errorMessage - Optional custom error message
 * @returns A wrapped function that throws if the original function returns a falsy value
 */
export function ensuringTruthy<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
  errorMessage = 'Function must return a truthy value',
): (...args: Parameters<T>) => ReturnType<T> {
  return function ensuredTruthy(...args: Parameters<T>): ReturnType<T> {
    const result = fn(...args);
    if (!result) {
      throw new Error(errorMessage);
    }
    return result;
  };
}

/** {@inheritdoc ensuringTruthy} */
export function ensuringTruthyAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(
  fn: T,
  errorMessage = 'Function must return a truthy value',
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async function ensuredTruthy(
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> {
    const result = await fn(...args);
    if (!result) {
      throw new Error(errorMessage);
    }
    return result;
  };
}

/**
 * Wraps a function to throw an error when it returns a truthy value.
 *
 * @param fn - The original function to wrap
 * @param errorMessage - Optional custom error message
 * @returns A wrapped function that throws if the original function returns a truthy value
 */
export function ensuringFalsy<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
  errorMessage = 'Function must return a falsy value',
): (...args: Parameters<T>) => ReturnType<T> {
  return function ensuredTruthy(...args: Parameters<T>): ReturnType<T> {
    const result = fn(...args);
    if (result) {
      throw new Error(errorMessage);
    }
    return result;
  };
}

/** {@inheritdoc ensuringTruthy} */
export function ensuringFalsyAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(
  fn: T,
  errorMessage = 'Function must return a falsy value',
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async function ensuredTruthy(
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> {
    const result = await fn(...args);
    if (result) {
      throw new Error(errorMessage);
    }
    return result;
  };
}

export function nonThrowing<const T extends (...args: any[]) => NotPromise,
  const StandIn extends null | false | true,>(
  fn: T,
  standIn: StandIn,
): (...args: Parameters<T>) => ReturnType<T> | StandIn {
  return function nonThrowingFn(...args: Parameters<T>): ReturnType<T> | StandIn {
    try {
      return fn(...args);
    } catch {
      return standIn;
    }
  };
}

export function nonThrowingAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
  const StandIn extends null | false | true,
>(
  fn: T,
  standIn: StandIn,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | StandIn> {
  return async function nonThrowingFn(
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>> | StandIn> {
    try {
      return await fn(...args);
    } catch {
      return standIn;
    }
  };
}

export function nonThrowingWithNull<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | null {
  return nonThrowing(fn, null);
}
export function nonThrowingWithNullAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | null> {
  return nonThrowingAsync(fn, null);
}
export function nonThrowingWithFalse<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | false {
  return nonThrowing(fn, false);
}

export function nonThrowingWithFalseAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | false> {
  return nonThrowingAsync(fn, false);
}

export function nonThrowingWithTrue<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | true {
  return nonThrowing(fn, true);
}

export function nonThrowingWithTrueAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | true> {
  return nonThrowingAsync(fn, true);
}
