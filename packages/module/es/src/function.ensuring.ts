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

/*export function nonThrowing<const Args extends any[], const Result extends NotPromise,>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result | null;

export function nonThrowing<const Args extends any[], const Result extends NotPromise,
  const StandIn extends boolean | null,>(
  fn: (...args: Args) => Result,
  standIn: StandIn,
): (...args: Args) => Result | StandIn;

export function nonThrowing<const Args extends any[], const Result extends NotPromise,
  const StandIn extends boolean | null,>(
  fn: (...args: Args) => Result,
  standIn?: StandIn,
): (...args: Args) => Result | StandIn | null {
  return function nonThrowingFn(...args: Args): Result | StandIn | null {
    try {
      return fn(...args);
    } catch {
      return standIn === undefined ? null : standIn;
    }
  };
}

export function nonThrowingAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
  const StandIn extends boolean | null,
>(
  fn: T,
  standIn?: StandIn,
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
}*/

export function nonThrowingWithNull<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | null {
  return function safe(...args: Parameters<T>) {
    try {
      return fn(...args);
    } catch {
      return null;
    }
  };
}
export function nonThrowingWithNullAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | null> {
  return async function safe(...args: Parameters<T>) {
    try {
      return await fn(...args);
    } catch {
      return null;
    }
  };
}
export function nonThrowingWithFalse<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | false {
  return function safe(...args: Parameters<T>) {
    try {
      return fn(...args);
    } catch {
      return false;
    }
  };
}

export function nonThrowingWithFalseAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | false> {
  return async function safe(...args: Parameters<T>) {
    try {
      return await fn(...args);
    } catch {
      return false;
    }
  };
}

export function nonThrowingWithTrue<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | true {
  return function safe(...args: Parameters<T>) {
    try {
      return fn(...args);
    } catch {
      return true;
    }
  };
}

export function nonThrowingWithTrueAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | true> {
  return async function safe(...args: Parameters<T>) {
    try {
      return await fn(...args);
    } catch {
      return true;
    }
  };
}
