import {
  expect as chaiExpect,
  use,
  type Assertion,
} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

use(chaiAsPromised,);
use(sinonChai,);

//region Matcher set builder

/**
 * Jest-style matcher methods backed by a chai Assertion instance.
 * Each method delegates to the corresponding chai assertion.
 */
export type MatcherSet = {
  toBe: (expected: unknown,) => void;
  toBeCloseTo: (expected: number, precision?: number,) => void;
  toBeDefined: () => void;
  toBeFalsy: () => void;
  toBeGreaterThan: (expected: number,) => void;
  toBeGreaterThanOrEqual: (expected: number,) => void;
  toBeInstanceOf: (expected: abstract new (...args: never) => unknown,) => void;
  toBeLessThan: (expected: number,) => void;
  toBeLessThanOrEqual: (expected: number,) => void;
  toBeNaN: () => void;
  toBeNull: () => void;
  toBeTruthy: () => void;
  toBeUndefined: () => void;
  toContain: (expected: unknown,) => void;
  toEqual: (expected: unknown,) => void;
  toHaveBeenCalled: () => void;
  toHaveBeenCalledTimes: (count: number,) => void;
  toHaveBeenCalledWith: (...args: ReadonlyArray<unknown>) => void;
  toHaveLength: (expected: number,) => void;
  toHaveProperty: (path: string, value?: unknown,) => void;
  toHaveReturnedWith: (expected: unknown,) => void;
  toMatch: (expected: string | RegExp,) => void;
  toMatchObject: (expected: Record<string, unknown>,) => void;
  toThrow: (expected?: string | RegExp | (abstract new (...args: never) => unknown),) => void;
};

/**
 * Builds a Jest-style matcher set from a chai Assertion instance.
 *
 * @param a - Chai assertion (may have `.not` flag set)
 *
 * @returns object with Jest-compatible matcher methods
 */
function buildMatchers(a: Assertion,): MatcherSet {
  return {
    toBe: function toBe(expected: unknown,): void {
      a.to.equal(expected,);
    },

    toEqual: function toEqual(expected: unknown,): void {
      a.to.deep.equal(expected,);
    },

    toContain: function toContain(expected: unknown,): void {
      a.to.include(expected,);
    },

    toThrow: function toThrow(expected?: string | RegExp | (abstract new (...args: never) => unknown),): void {
      if (expected !== undefined) {
        a.to.throw(expected as Parameters<typeof a.to.throw>[0],);
      }
      else {
        a.to.throw();
      }
    },

    toBeCloseTo: function toBeCloseTo(expected: number, precision: number = 2,): void {
      const HALF = 1 / 2;
      // oxlint-disable-next-line prefer-exponentiation-operator -- Math.pow is clearer here with a variable exponent
      a.to.be.closeTo(expected, Math.pow(10, -precision,) * HALF,);
    },

    toBeGreaterThan: function toBeGreaterThan(expected: number,): void {
      a.to.be.above(expected,);
    },

    toBeGreaterThanOrEqual: function toBeGreaterThanOrEqual(expected: number,): void {
      a.to.be.at.least(expected,);
    },

    toBeLessThan: function toBeLessThan(expected: number,): void {
      a.to.be.below(expected,);
    },

    toBeLessThanOrEqual: function toBeLessThanOrEqual(expected: number,): void {
      a.to.be.at.most(expected,);
    },

    toBeDefined: function toBeDefined(): void {
      a.to.not.be.undefined;
    },

    toBeUndefined: function toBeUndefined(): void {
      a.to.be.undefined;
    },

    toBeNaN: function toBeNaN(): void {
      a.to.be.NaN;
    },

    toBeNull: function toBeNull(): void {
      a.to.be.null;
    },

    toBeTruthy: function toBeTruthy(): void {
      a.to.be.ok;
    },

    toBeFalsy: function toBeFalsy(): void {
      a.to.not.be.ok;
    },

    toHaveLength: function toHaveLength(expected: number,): void {
      a.to.have.lengthOf(expected,);
    },

    toHaveProperty: function toHaveProperty(path: string, value?: unknown,): void {
      if (value !== undefined) {
        a.to.have.nested.property(path, value,);
      }
      else {
        a.to.have.nested.property(path,);
      }
    },

    toMatch: function toMatch(expected: string | RegExp,): void {
      a.to.match(expected instanceof RegExp ? expected : new RegExp(expected,),);
    },

    toMatchObject: function toMatchObject(expected: Record<string, unknown>,): void {
      a.to.deep.include(expected,);
    },

    toBeInstanceOf: function toBeInstanceOf(expected: abstract new (...args: never) => unknown,): void {
      a.to.be.instanceOf(expected,);
    },

    //region sinon-chai matchers

    toHaveBeenCalled: function toHaveBeenCalled(): void {
      a.to.have.been.called;
    },

    toHaveBeenCalledTimes: function toHaveBeenCalledTimes(count: number,): void {
      a.to.have.callCount(count,);
    },

    toHaveBeenCalledWith: function toHaveBeenCalledWith(...args: ReadonlyArray<unknown>): void {
      a.to.have.been.calledWith(...args,);
    },

    toHaveReturnedWith: function toHaveReturnedWith(expected: unknown,): void {
      a.to.have.returned(expected,);
    },

    //endregion sinon-chai matchers
  };
}

//endregion Matcher set builder

//region Async matcher set builder

/**
 * Async versions of Jest-style matchers for promise-based assertions.
 * Each method returns a Promise that resolves on success or rejects on failure.
 * Used by `expect(promise).rejects` and `expect(promise).resolves`.
 */
export type AsyncMatcherSet = {
  [K in keyof MatcherSet]: (...args: Parameters<MatcherSet[K]>) => Promise<void>;
};

/**
 * Wraps a sync `MatcherSet` builder into an async one by awaiting a value
 * first, then building and calling the corresponding sync matcher.
 *
 * @param getValue - Async function that produces the value to assert on
 *
 * @returns object with async Jest-compatible matcher methods
 */
function buildAsyncMatchers(getValue: () => Promise<unknown>,): AsyncMatcherSet {
  /**
   * Creates an async wrapper for a single matcher method.
   * Awaits the value, builds a sync matcher set, then calls the named method.
   *
   * @param key - Matcher method name
   *
   * @returns async function with the same signature
   */
  function wrapMatcher<K extends keyof MatcherSet>(key: K,): (...args: Parameters<MatcherSet[K]>) => Promise<void> {
    return async function wrappedMatcher(...args: Parameters<MatcherSet[K]>): Promise<void> {
      const value = await getValue();
      const matchers = buildMatchers(chaiExpect(value,),);
      // oxlint-disable-next-line no-unsafe-argument -- args are typed by MatcherSet[K]
      (matchers[key] as (...a: ReadonlyArray<unknown>) => void)(...args,);
    };
  }

  const syncKeys = Object.keys(buildMatchers(chaiExpect(undefined,),),) as ReadonlyArray<keyof MatcherSet>;
  const result = {} as Record<string, (...args: ReadonlyArray<unknown>) => Promise<void>>;

  for (const key of syncKeys) {
    result[key] = wrapMatcher(key,);
  }

  return result as unknown as AsyncMatcherSet;
}

/**
 * Builds an async matcher set that awaits a promise's rejection,
 * then runs sync matchers against the rejected value.
 *
 * @param promise - Promise expected to reject
 *
 * @returns object with async Jest-compatible matcher methods
 */
function buildRejectsMatchers(promise: Promise<unknown>,): AsyncMatcherSet {
  /**
   * Awaits rejection and returns the error value.
   * Throws if the promise resolves instead of rejecting.
   *
   * @returns rejected value
   *
   * @throws Error when the promise resolves unexpectedly
   */
  async function getRejection(): Promise<unknown> {
    try {
      await promise;
    }
    catch (error) {
      return error;
    }
    throw new Error('Expected promise to reject, but it resolved',);
  }

  return buildAsyncMatchers(getRejection,);
}

/**
 * Builds an async matcher set that awaits a promise's resolution,
 * then runs sync matchers against the resolved value.
 *
 * @param promise - Promise expected to resolve
 *
 * @returns object with async Jest-compatible matcher methods
 */
function buildResolvesMatchers(promise: Promise<unknown>,): AsyncMatcherSet {
  async function getResolution(): Promise<unknown> {
    return promise;
  }

  return buildAsyncMatchers(getResolution,);
}

//endregion Async matcher set builder

//region expect function

/**
 * Result of calling `expect(actual)`.
 * Provides Jest-style matchers, a `not` property for negation,
 * and `rejects`/`resolves` for promise assertions.
 */
export type ExpectResult = MatcherSet & {
  /** Negated matchers -- every method asserts the opposite. */
  readonly not: MatcherSet;
  /** Async matchers that await rejection, then assert on the rejected value. */
  readonly rejects: AsyncMatcherSet;
  /** Async matchers that await resolution, then assert on the resolved value. */
  readonly resolves: AsyncMatcherSet;
};

/**
 * Jest-style `expect(actual)` powered by chai, chai-as-promised, and sinon-chai.
 *
 * Sync matchers assert immediately.
 * `rejects`/`resolves` return async matchers that await the promise first.
 *
 * @param actual - Value or spy to assert against
 *
 * @returns object with Jest-compatible matcher methods, `.not`, `.rejects`, `.resolves`
 *
 * @example
 * ```ts
 * expect(add(1, 2)).toBe(3);
 * expect([1, 2, 3]).toContain(2);
 * expect(spy).toHaveBeenCalledWith('hello');
 * expect(value).not.toBeUndefined();
 * await expect(promise).rejects.toBeInstanceOf(Error);
 * await expect(promise).resolves.toBe(42);
 * ```
 */
function expect(actual: unknown,): ExpectResult {
  return {
    ...buildMatchers(chaiExpect(actual,),),
    not: buildMatchers(chaiExpect(actual,).not,),
    rejects: buildRejectsMatchers(actual as Promise<unknown>,),
    resolves: buildResolvesMatchers(actual as Promise<unknown>,),
  };
}

//endregion expect function

//region Asymmetric matchers

/**
 * Matches any string containing the given substring.
 * For use inside `toHaveBeenCalledWith` and similar matchers.
 *
 * @param str - Substring to match
 *
 * @returns sinon matcher that checks for substring presence
 *
 * @example
 * ```ts
 * expect(spy).toHaveBeenCalledWith(expect.stringContaining('hello'));
 * ```
 */
expect.stringContaining = function stringContaining(str: string,) {
  return sinon.match(str,);
};

/**
 * Matches any string that matches the given regular expression.
 * For use inside `toHaveBeenCalledWith` and similar matchers.
 *
 * @param pattern - Regular expression to match against
 *
 * @returns sinon matcher that checks regex match
 *
 * @example
 * ```ts
 * expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^hello/));
 * ```
 */
expect.stringMatching = function stringMatching(pattern: RegExp,) {
  return sinon.match(pattern,);
};

/**
 * Matches any object that deeply includes the given subset.
 *
 * @param obj - Partial object to match against
 *
 * @returns sinon matcher that checks for partial object match
 *
 * @example
 * ```ts
 * expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
 * ```
 */
expect.objectContaining = function objectContaining(obj: Record<string, unknown>,) {
  return sinon.match(obj,);
};

/**
 * Matches any value. Useful as a placeholder in `toHaveBeenCalledWith`.
 *
 * @returns sinon matcher that matches anything
 *
 * @example
 * ```ts
 * expect(spy).toHaveBeenCalledWith(expect.anything(), 'specific');
 * ```
 */
expect.anything = function anything() {
  return sinon.match.any;
};

/**
 * Matches any instance of the given constructor.
 *
 * @param ctor - Constructor function to match against
 *
 * @returns sinon matcher that checks `instanceof`
 *
 * @example
 * ```ts
 * expect(spy).toHaveBeenCalledWith(expect.any(Error));
 * ```
 */
expect.any = function any(ctor: abstract new (...args: never) => unknown,) {
  return sinon.match.instanceOf(ctor,);
};

/**
 * Matches any array that contains all elements of the given array,
 * in any order.
 *
 * @param arr - Elements that must be present in the matched array
 *
 * @returns sinon matcher that checks array containment
 *
 * @example
 * ```ts
 * expect(spy).toHaveBeenCalledWith(expect.arrayContaining([1, 2]));
 * ```
 */
expect.arrayContaining = function arrayContaining(arr: ReadonlyArray<unknown>,) {
  return sinon.match(function matchArrayContaining(actual: unknown,): boolean {
    if (!Array.isArray(actual,)) {
      return false;
    }
    return arr.every(function isContained(item,) {
      return actual.includes(item,);
    },);
  }, `arrayContaining([${arr.join(', ',)}])`,);
};

//endregion Asymmetric matchers

export { expect, };
