/**
 * Core value-comparison matcher factories for the test module's expect.
 * Split out of `expect-matchers.ts` to keep each module under the
 * line-count limit; `buildMatchers` merges this subset with the sinon
 * spy matchers into the full {@link MatcherSet}.
 *
 * @module
 */

import type { MatcherSet, } from './expect-matchers.ts';

/**
 * Value-comparison matcher methods, the subset of {@link MatcherSet}
 * that asserts on a value directly and needs only the chai Assertion.
 */
export type CoreMatcherSet = Pick<
  MatcherSet,
  | 'toBe'
  | 'toEqual'
  | 'toContain'
  | 'toContainEqual'
  | 'toThrow'
  | 'toBeCloseTo'
  | 'toBeGreaterThan'
  | 'toBeGreaterThanOrEqual'
  | 'toBeLessThan'
  | 'toBeLessThanOrEqual'
  | 'toBeDefined'
  | 'toBeUndefined'
  | 'toBeNaN'
  | 'toBeNull'
  | 'toBeTruthy'
  | 'toBeFalsy'
  | 'toBeTypeOf'
  | 'toHaveLength'
  | 'toHaveProperty'
  | 'toMatch'
  | 'toMatchObject'
  | 'toBeInstanceOf'
  | 'toSatisfy'
  | 'toStrictEqual'
>;

/**
 * Builds the core value-comparison matcher subset from a chai Assertion
 * instance. None of these matchers need the raw `actual` value, so the
 * builder takes only the assertion.
 *
 * @param a - Chai assertion (may have `.not` flag set)
 *
 * @returns object with the value-comparison matcher methods
 *
 * @example
 * ```ts
 * const coreMatchers = buildCoreMatchers({ a: chaiExpect(42) });
 * coreMatchers.toBe(42);
 * ```
 */
export function buildCoreMatchers(
  {
    a,
  }: {
    readonly a: Chai.Assertion;
  },
): CoreMatcherSet {
  return {
    toBe: function toBe(expected: unknown,): void {
      a.to
        .equal(expected,);
    },

    toEqual: function toEqual(expected: unknown,): void {
      a.to
        .deep
        .equal(expected,);
    },

    toContain: function toContain(expected: unknown,): void {
      a.to
        .include(expected,);
    },

    toContainEqual: function toContainEqual(expected: unknown,): void {
      a.to
        .deep
        .include(expected,);
    },

    toThrow: function toThrow(
      expected?: string | RegExp | (abstract new(...args: never) => unknown),
    ): void {
      if (expected === undefined) {
        a.to
          .throw();
      }
      else if (((typeof expected) === 'string') || (expected instanceof RegExp)) {
        a.to
          .throw(expected,);
      }
      else {
        a.to
          .throw(expected,);
      }
    },

    toBeCloseTo: function toBeCloseTo(
      expected: number,
      precision: number = 2,
    ): void {
      /**
       * Half-tolerance multiplier (named to keep the magic constant rule from firing on `0.5`).
       */
      const HALF = 1 / 2;
      /* oxlint-disable prefer-exponentiation-operator -- Math.pow is clearer here with a variable exponent */
      /**
       * Floating-point tolerance derived from `precision` so chai's `closeTo` accepts values within +/-HALF of the lowest place.
       */
      const delta = Math.pow(
        10,
        -precision,
      )
        * HALF;
      /* oxlint-enable prefer-exponentiation-operator */

      a.to
        .be
        .closeTo(
        expected,
        delta,
      );
    },

    toBeGreaterThan: function toBeGreaterThan(expected: number,): void {
      a.to
        .be
        .above(expected,);
    },

    toBeGreaterThanOrEqual: function toBeGreaterThanOrEqual(expected: number,): void {
      a.to
        .be
        .at
        .least(expected,);
    },

    toBeLessThan: function toBeLessThan(expected: number,): void {
      a.to
        .be
        .below(expected,);
    },

    toBeLessThanOrEqual: function toBeLessThanOrEqual(expected: number,): void {
      a.to
        .be
        .at
        .most(expected,);
    },

    toBeDefined: function toBeDefined(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to
        .not
        .be
        .undefined;
    },

    toBeUndefined: function toBeUndefined(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to
        .be
        .undefined;
    },

    toBeNaN: function toBeNaN(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to
        .be
        .NaN;
    },

    toBeNull: function toBeNull(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to
        .be
        .null;
    },

    toBeTruthy: function toBeTruthy(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to
        .be
        .ok;
    },

    toBeFalsy: function toBeFalsy(): void {
      // oxlint-disable-next-line no-unused-expressions -- chai property assertion
      a.to
        .not
        .be
        .ok;
    },

    toBeTypeOf: function toBeTypeOf(
      expected: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string'
        | 'symbol' | 'undefined',
    ): void {
      a.to
        .be
        .a(expected,);
    },

    toHaveLength: function toHaveLength(expected: number,): void {
      a.to
        .have
        .lengthOf(expected,);
    },

    toHaveProperty: function toHaveProperty(
      path: string,
      value?: unknown,
    ): void {
      if (value !== undefined) {
        a.to
          .have
          .nested
          .property(
          path,
          value,
        );
      }
      else {
        a.to
          .have
          .nested
          .property(path,);
      }
    },

    toMatch: function toMatch(expected: string | RegExp,): void {
      a.to
        // oxlint-disable-next-line no-restricted-syntax/no-regex, eslint/require-unicode-regexp -- Jest-compatible `toMatch` accepts a string pattern that must be compiled to a RegExp for chai's `.match`; input is the test author's expected pattern, bounded by test fixtures, not attacker-controlled. The `u` flag is omitted deliberately so a user string with non-`u`-safe escapes is not rejected, preserving prior string-to-regex behaviour.
        .match(expected instanceof RegExp ? expected : new RegExp(expected,),);
    },

    toMatchObject: function toMatchObject(expected: Readonly<Record<string, unknown>>,): void {
      a.to
        .deep
        .include(expected,);
    },

    toBeInstanceOf: function toBeInstanceOf(
      expected: abstract new(...args: never) => unknown,
    ): void {
      a.to
        .be
        .instanceOf(expected,);
    },

    toSatisfy: function toSatisfy(predicate: (value: unknown,) => boolean,): void {
      a.to
        .satisfy(predicate,);
    },

    toStrictEqual: function toStrictEqual(expected: unknown,): void {
      a.to
        .deep
        .equal(expected,);
    },
  };
}
