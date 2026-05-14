/**
 * Matcher set builders for the test module's expect implementation.
 * Contains the core chai-backed matcher factories for both sync and async assertions.
 *
 * @module
 */

import {
  expect as chaiExpect,
  use,
} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { SinonSpy, } from 'sinon';
import sinonChai from 'sinon-chai';

// oxlint-disable-next-line no-unsafe-call -- chai plugin registration is untyped
use(chaiAsPromised,);
// oxlint-disable-next-line no-unsafe-call -- chai plugin registration is untyped
use(sinonChai,);

//region Matcher set builder

/**
 * Jest-style matcher methods backed by a chai Assertion instance.
 * Each method delegates to the corresponding chai assertion.
 */
export type MatcherSet = {
  toBe: (expected: unknown,) => void;
  toBeCloseTo: (
    expected: number,
    precision?: number,
  ) => void;
  toBeDefined: () => void;
  toBeFalsy: () => void;
  toBeGreaterThan: (expected: number,) => void;
  toBeGreaterThanOrEqual: (expected: number,) => void;
  toBeInstanceOf: (expected: abstract new(...args: never) => unknown,) => void;
  toBeLessThan: (expected: number,) => void;
  toBeLessThanOrEqual: (expected: number,) => void;
  toBeNaN: () => void;
  toBeNull: () => void;
  toBeTruthy: () => void;
  toBeTypeOf: (
    expected: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string'
      | 'symbol' | 'undefined',
  ) => void;
  toBeUndefined: () => void;
  toContain: (expected: unknown,) => void;
  toContainEqual: (expected: unknown,) => void;
  toEqual: (expected: unknown,) => void;
  toHaveBeenCalled: () => void;
  toHaveBeenCalledExactlyOnceWith: (...args: readonly unknown[]) => void;
  toHaveBeenCalledTimes: (count: number,) => void;
  toHaveBeenCalledWith: (...args: readonly unknown[]) => void;
  toHaveBeenLastCalledWith: (...args: readonly unknown[]) => void;
  toHaveBeenNthCalledWith: (
    n: number,
    ...args: readonly unknown[]
  ) => void;
  toHaveLength: (expected: number,) => void;
  toHaveProperty: (
    path: string,
    value?: unknown,
  ) => void;
  toHaveReturned: () => void;
  toHaveReturnedTimes: (count: number,) => void;
  toHaveReturnedWith: (expected: unknown,) => void;
  toHaveLastReturnedWith: (expected: unknown,) => void;
  toHaveNthReturnedWith: (
    n: number,
    expected: unknown,
  ) => void;
  toMatch: (expected: string | RegExp,) => void;
  toMatchObject: (expected: Record<string, unknown>,) => void;
  toSatisfy: (predicate: (value: unknown,) => boolean,) => void;
  toStrictEqual: (expected: unknown,) => void;
  toThrow: (
    expected?: string | RegExp | (abstract new(...args: never) => unknown),
  ) => void;
};

/**
 * Builds a Jest-style matcher set from a chai Assertion instance.
 *
 * @param a - Chai assertion (may have `.not` flag set)
 *
 * @param actual - Raw value being asserted on, passed through for matchers that need direct access
 *
 * @returns object with Jest-compatible matcher methods
 *
 * @example
 * ```ts
 * const matchers = buildMatchers({ a: chaiExpect(value), actual: value });
 * matchers.toBe(42);
 * ```
 */
export function buildMatchers(
  {
    a,
    actual,
  }: {
    readonly a: Chai.Assertion;
    readonly actual: unknown;
  },
): MatcherSet {
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

    toContainEqual: function toContainEqual(expected: unknown,): void {
      a.to.deep.include(expected,);
    },

    toThrow: function toThrow(
      expected?: string | RegExp | (abstract new(...args: never) => unknown),
    ): void {
      if (expected !== undefined) {
        // oxlint-disable-next-line no-unsafe-type-assertion -- chai's throw() accepts string|RegExp|ErrorConstructor but the union type doesn't narrow cleanly
        a.to.throw(expected as Parameters<typeof a.to.throw>[0],);
      }
      else {
        a.to.throw();
      }
    },

    toBeCloseTo: function toBeCloseTo(
      expected: number,
      precision: number = 2,
    ): void {
      /** Half-tolerance multiplier (named to keep the magic constant rule from firing on `0.5`). */
      const HALF = 1 / 2;
      /* oxlint-disable prefer-exponentiation-operator -- Math.pow is clearer here with a variable exponent */
      /** Floating-point tolerance derived from `precision` so chai's `closeTo` accepts values within +/-HALF of the lowest place. */
      const delta = Math.pow(
        10,
        -precision,
      ) * HALF;
      /* oxlint-enable prefer-exponentiation-operator */

      a.to.be.closeTo(
        expected,
        delta,
      );
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
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to.not.be.undefined;
    },

    toBeUndefined: function toBeUndefined(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to.be.undefined;
    },

    toBeNaN: function toBeNaN(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to.be.NaN;
    },

    toBeNull: function toBeNull(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to.be.null;
    },

    toBeTruthy: function toBeTruthy(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to.be.ok;
    },

    toBeFalsy: function toBeFalsy(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to.not.be.ok;
    },

    toBeTypeOf: function toBeTypeOf(
      expected: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string'
        | 'symbol' | 'undefined',
    ): void {
      a.to.be.a(expected,);
    },

    toHaveLength: function toHaveLength(expected: number,): void {
      a.to.have.lengthOf(expected,);
    },

    toHaveProperty: function toHaveProperty(
      path: string,
      value?: unknown,
    ): void {
      if (value !== undefined) {
        a.to.have.nested.property(
          path,
          value,
        );
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

    toBeInstanceOf: function toBeInstanceOf(
      expected: abstract new(...args: never) => unknown,
    ): void {
      a.to.be.instanceOf(expected,);
    },

    toSatisfy: function toSatisfy(predicate: (value: unknown,) => boolean,): void {
      a.to.satisfy(predicate,);
    },

    toStrictEqual: function toStrictEqual(expected: unknown,): void {
      a.to.deep.equal(expected,);
    },

    //region sinon-chai matchers

    toHaveBeenCalled: function toHaveBeenCalled(): void {
      // oxlint-disable-next-line no-unused-expressions -- sinon-chai property assertion
      a.to.have.been.called;
    },

    toHaveBeenCalledExactlyOnceWith: function toHaveBeenCalledExactlyOnceWith(
      ...args: readonly unknown[]
    ): void {
      /* oxlint-disable no-unsafe-type-assertion -- actual is expected to be a sinon spy */
      /** Captured spy reference reused across the call-count and first-call argument assertions. */
      const spy = actual as SinonSpy;
      /* oxlint-enable no-unsafe-type-assertion */

      chaiExpect(
        spy.callCount,
        'expected spy to have been called exactly once',
      )
        .to
        .equal(1,);
      chaiExpect(spy.firstCall.args,).to.deep.equal([...args,],);
    },

    toHaveBeenCalledTimes: function toHaveBeenCalledTimes(count: number,): void {
      a.to.have.callCount(count,);
    },

    toHaveBeenCalledWith: function toHaveBeenCalledWith(
      ...args: readonly unknown[]
    ): void {
      a.to.have.been.calledWith(...args,);
    },

    toHaveBeenLastCalledWith: function toHaveBeenLastCalledWith(
      ...args: readonly unknown[]
    ): void {
      /* oxlint-disable no-unsafe-type-assertion -- actual is expected to be a sinon spy with lastCall property */
      /** Captured spy reference so the `lastCall` destructure below reads from a typed value. */
      const spy = actual as SinonSpy;
      /* oxlint-enable no-unsafe-type-assertion */
      /** Destructured most recent call so subsequent assertions read directly without re-accessing the spy. */
      const { lastCall, } = spy;

      chaiExpect(
        lastCall,
        'expected spy to have been called at least once',
      )
        .to
        .not
        .equal(null,);
      chaiExpect(lastCall.args,).to.deep.equal([...args,],);
    },

    toHaveBeenNthCalledWith: function toHaveBeenNthCalledWith(
      n: number,
      ...args: readonly unknown[]
    ): void {
      /* oxlint-disable no-unsafe-type-assertion -- actual is expected to be a sinon spy with getCall method */
      /** Captured spy reference so `getCall` below reads from a typed value. */
      const spy = actual as SinonSpy;
      /* oxlint-enable no-unsafe-type-assertion */
      /** Captured call at the requested 1-based index, reused for the null check and argument comparison. */
      const nthCall = spy.getCall(n - 1,);

      chaiExpect(
        nthCall,
        `expected spy to have been called at least ${String(n,)} times`,
      )
        .to
        .not
        .equal(null,);
      chaiExpect(nthCall.args,).to.deep.equal([...args,],);
    },

    toHaveReturned: function toHaveReturned(): void {
      /* oxlint-disable no-unsafe-type-assertion -- actual is expected to be a sinon spy */
      /** Captured spy reference so `getCalls` below reads from a typed value. */
      const spy = actual as SinonSpy;
      /* oxlint-enable no-unsafe-type-assertion */
      /** Captured returned-at-least-once flag reused inside the chai assertion below. */
      const hasReturned = spy.getCalls().some(function didReturn(call,) {
        return call.exception === undefined;
      },);

      chaiExpect(
        hasReturned,
        'expected spy to have returned at least once',
      )
        .to
        .equal(
          true,
        );
    },

    toHaveReturnedTimes: function toHaveReturnedTimes(count: number,): void {
      /* oxlint-disable no-unsafe-type-assertion -- actual is expected to be a sinon spy */
      /** Captured spy reference so the call-list pipeline below reads from a typed value. */
      const spy = actual as SinonSpy;
      /* oxlint-enable no-unsafe-type-assertion */
      /** Captured count of returning calls used in the chai assertion below. */
      const returnCount = spy
        .getCalls()
        .filter(function didReturn(call,) {
          return call.exception === undefined;
        },)
        .length;

      chaiExpect(
        returnCount,
        `expected spy to have returned ${String(count,)} times`,
      )
        .to
        .equal(count,);
    },

    toHaveReturnedWith: function toHaveReturnedWith(expected: unknown,): void {
      a.to.have.returned(expected,);
    },

    toHaveLastReturnedWith: function toHaveLastReturnedWith(expected: unknown,): void {
      /* oxlint-disable no-unsafe-type-assertion -- actual is expected to be a sinon spy */
      /** Captured spy reference so the `lastCall` destructure below reads from a typed value. */
      const spy = actual as SinonSpy;
      /* oxlint-enable no-unsafe-type-assertion */
      /** Destructured most recent call so subsequent assertions read directly without re-accessing the spy. */
      const { lastCall, } = spy;

      chaiExpect(
        lastCall,
        'expected spy to have been called at least once',
      )
        .to
        .not
        .equal(null,);
      chaiExpect(lastCall.returnValue,).to.deep.equal(expected,);
    },

    toHaveNthReturnedWith: function toHaveNthReturnedWith(
      n: number,
      expected: unknown,
    ): void {
      /* oxlint-disable no-unsafe-type-assertion -- actual is expected to be a sinon spy */
      /** Captured spy reference so `getCall` below reads from a typed value. */
      const spy = actual as SinonSpy;
      /* oxlint-enable no-unsafe-type-assertion */
      /** Captured call at the requested 1-based index, reused for the null check and return-value comparison. */
      const nthCall = spy.getCall(n - 1,);

      chaiExpect(
        nthCall,
        `expected spy to have been called at least ${String(n,)} times`,
      )
        .to
        .not
        .equal(null,);
      chaiExpect(nthCall.returnValue,).to.deep.equal(expected,);
    },
    //endregion sinon-chai matchers
  };
}

//endregion Matcher set builder

export { chaiExpect, };
