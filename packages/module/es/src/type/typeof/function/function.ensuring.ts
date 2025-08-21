import type { Promisable, } from 'type-fest';
import type { NotPromise, } from '../../../promise.type.ts';

//region Function Ensuring Utilities -- Function wrappers that enforce return value conditions and handle errors

/**
 * Wraps a function to throw an error when it returns a falsy value.
 *
 * @param fn - Function to wrap with truthy validation
 * @param errorMessage - Custom error message when validation fails
 * @returns Wrapped function that throws if original function returns falsy value
 * @throws {Error} When wrapped function returns falsy value
 * @example
 * ```ts
 * const getPositiveNumber = ensuringTruthy((x: number) => x > 0 ? x : 0);
 * getPositiveNumber(5); // Returns 5
 * getPositiveNumber(-1); // Throws Error: "Function must return a truthy value"
 * ```
 */
export function ensuringTruthy<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
  errorMessage = 'Function must return a truthy value',
): (...args: Parameters<T>) => ReturnType<T> {
  return function ensuredTruthy(...args: Parameters<T>): ReturnType<T> {
    const result = fn(...args,);
    if (!result)
      throw new Error(errorMessage,);
    return result;
  };
}

/**
 * {@inheritDoc ensuringTruthy}
 */
export function ensuringTruthyAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(
  fn: T,
  errorMessage = 'Function must return a truthy value',
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async function ensuredTruthy(
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> {
    const result = await fn(...args,);
    if (!result)
      throw new Error(errorMessage,);
    return result;
  };
}

/**
 * Wraps a function to throw an error when it returns a truthy value.
 *
 * @param fn - Function to wrap with falsy validation
 * @param errorMessage - Custom error message when validation fails
 * @returns Wrapped function that throws if original function returns truthy value
 * @throws {Error} When wrapped function returns truthy value
 * @example
 * ```ts
 * const ensureNoError = ensuringFalsy((code: number) => code === 0 ? 0 : code);
 * ensureNoError(0); // Returns 0
 * ensureNoError(1); // Throws Error: "Function must return a falsy value"
 * ```
 */
export function ensuringFalsy<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
  errorMessage = 'Function must return a falsy value',
): (...args: Parameters<T>) => ReturnType<T> {
  return function ensuredFalsy(...args: Parameters<T>): ReturnType<T> {
    const result = fn(...args,);
    if (result)
      throw new Error(errorMessage,);
    return result;
  };
}

/**
 * {@inheritDoc ensuringFalsy}
 */
export function ensuringFalsyAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(
  fn: T,
  errorMessage = 'Function must return a falsy value',
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  return async function ensuredFalsy(
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> {
    const result = await fn(...args,);
    if (result)
      throw new Error(errorMessage,);
    return result;
  };
}

/**
 * Wraps a function to return null instead of throwing errors.
 *
 * @param fn - Function to wrap with null fallback
 * @returns Wrapped function that returns null on errors instead of throwing
 * @example
 * ```ts
 * const safeParseInt = nonThrowingWithNull((str: string) => {
 *   const num = parseInt(str);
 *   if (isNaN(num)) throw new Error('Invalid number');
 *   return num;
 * });
 * safeParseInt('123'); // Returns 123
 * safeParseInt('abc'); // Returns null
 * ```
 */
export function nonThrowingWithNull<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | null {
  return function safe(...args: Parameters<T>) {
    try {
      return fn(...args,);
    }
    catch {
      return null;
    }
  };
}

/**
 * {@inheritDoc nonThrowingWithNull}
 */
export function nonThrowingWithNullAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T,): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | null> {
  return async function safe(...args: Parameters<T>) {
    try {
      return await fn(...args,);
    }
    catch {
      return null;
    }
  };
}

/**
 * Wraps a function to return false instead of throwing errors.
 *
 * @param fn - Function to wrap with false fallback
 * @returns Wrapped function that returns false on errors instead of throwing
 * @example
 * ```ts
 * const isValidEmail = nonThrowingWithFalse((email: string) => {
 *   if (!email.includes('@')) throw new Error('Invalid email');
 *   return true;
 * });
 * isValidEmail('test@example.com'); // Returns true
 * isValidEmail('invalid'); // Returns false
 * ```
 */
export function nonThrowingWithFalse<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | false {
  return function safe(...args: Parameters<T>) {
    try {
      return fn(...args,);
    }
    catch {
      return false;
    }
  };
}

/**
 * {@inheritDoc nonThrowingWithFalse}
 */
export function nonThrowingWithFalseAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T,): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | false> {
  return async function safe(...args: Parameters<T>) {
    try {
      return await fn(...args,);
    }
    catch {
      return false;
    }
  };
}

/**
 * Wraps a function to return true instead of throwing errors.
 *
 * @param fn - Function to wrap with true fallback
 * @returns Wrapped function that returns true on errors instead of throwing
 * @example
 * ```ts
 * const hasError = nonThrowingWithTrue((operation: () => void) => {
 *   operation();
 *   return false; // No error occurred
 * });
 * hasError(() => console.log('ok')); // Returns false
 * hasError(() => { throw new Error(); }); // Returns true
 * ```
 */
export function nonThrowingWithTrue<const T extends (...args: any[]) => NotPromise,>(
  fn: T,
): (...args: Parameters<T>) => ReturnType<T> | true {
  return function safe(...args: Parameters<T>) {
    try {
      return fn(...args,);
    }
    catch {
      return true;
    }
  };
}

/**
 * {@inheritDoc nonThrowingWithTrue}
 */
export function nonThrowingWithTrueAsync<
  const T extends (...args: any[]) => Promisable<NotPromise>,
>(fn: T,): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | true> {
  return async function safe(...args: Parameters<T>) {
    try {
      return await fn(...args,);
    }
    catch {
      return true;
    }
  };
}

//endregion Function Ensuring Utilities
