/**
 * Tests for `expect` matchers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

await describe({
  // oxlint-disable-next-line no-restricted-syntax/prefer-describe-function-ref-name -- harness self-test; the function under test IS the local binding, so `expect.name` is circular
  name: 'expect',
  children: [
    //region toBe (strict equality)

    it({
      name: 'toBe passes for identical primitives',
      fn: async () => {
        expect(1,).toBe(1,);
        expect('hello',).toBe('hello',);
        expect(true,).toBe(true,);
        expect(null,).toBe(null,);
        expect(undefined,).toBe(undefined,);
      },
    },),

    it({
      name: 'toBe fails for different object references',
      fails: true,
      fn: async () => {
        const a = { x: 1, };
        const b = { x: 1, };
        expect(a,).toBe(b,);
      },
    },),

    it({
      name: 'toBe passes for same object reference',
      fn: async () => {
        const obj = { x: 1, };
        expect(obj,).toBe(obj,);
      },
    },),

    //endregion toBe (strict equality)

    //region toEqual (deep equality)

    it({
      name: 'toEqual passes for deep-equal objects',
      fn: async () => {
        expect({ a: 1, b: [2, 3,], },).toEqual({ a: 1, b: [2, 3,], },);
      },
    },),

    it({
      name: 'toEqual passes for nested structures',
      fn: async () => {
        expect({ a: { b: { c: 1, }, }, },).toEqual({ a: { b: { c: 1, }, }, },);
      },
    },),

    //endregion toEqual (deep equality)

    //region toContain

    it({
      name: 'toContain passes for array element',
      fn: async () => {
        expect([1, 2, 3,],).toContain(2,);
      },
    },),

    it({
      name: 'toContain passes for substring',
      fn: async () => {
        expect('hello world',).toContain('world',);
      },
    },),

    //endregion toContain

    //region toThrow

    it({
      name: 'toThrow passes for throwing function',
      fn: async () => {
        expect(() => {
          throw new Error('boom',);
        },)
          .toThrow();
      },
    },),

    it({
      name: 'toThrow matches error message',
      fn: async () => {
        expect(() => {
          throw new Error('specific error',);
        },)
          .toThrow('specific error',);
      },
    },),

    it({
      name: 'toThrow matches error class',
      fn: async () => {
        expect(() => {
          throw new TypeError('type issue',);
        },)
          .toThrow(TypeError,);
      },
    },),

    it({
      name: 'toThrow matches regex',
      fn: async () => {
        expect(() => {
          throw new Error('something went wrong',);
        },)
          .toThrow(/went wrong/,);
      },
    },),

    //endregion toThrow

    //region Numeric comparisons

    it({
      name: 'toBeGreaterThan works',
      fn: async () => {
        expect(5,).toBeGreaterThan(3,);
      },
    },),

    it({
      name: 'toBeGreaterThanOrEqual works',
      fn: async () => {
        expect(5,).toBeGreaterThanOrEqual(5,);
        expect(6,).toBeGreaterThanOrEqual(5,);
      },
    },),

    it({
      name: 'toBeLessThan works',
      fn: async () => {
        expect(3,).toBeLessThan(5,);
      },
    },),

    it({
      name: 'toBeLessThanOrEqual works',
      fn: async () => {
        expect(5,).toBeLessThanOrEqual(5,);
        expect(4,).toBeLessThanOrEqual(5,);
      },
    },),

    it({
      name: 'toBeCloseTo works with default precision',
      fn: async () => {
        expect(0.1 + 0.2,).toBeCloseTo(0.3,);
      },
    },),

    it({
      name: 'toBeCloseTo works with custom precision',
      fn: async () => {
        expect(1.005,).toBeCloseTo(1, 0,);
        expect(1.005,).toBeCloseTo(1.01, 1,);
      },
    },),

    //endregion Numeric comparisons

    //region Type checks

    it({
      name: 'toBeUndefined works',
      fn: async () => {
        expect(undefined,).toBeUndefined();
      },
    },),

    it({
      name: 'toBeNull works',
      fn: async () => {
        expect(null,).toBeNull();
      },
    },),

    it({
      name: 'toBeTruthy works',
      fn: async () => {
        expect(1,).toBeTruthy();
        expect('yes',).toBeTruthy();
        expect({},).toBeTruthy();
      },
    },),

    it({
      name: 'toBeFalsy works',
      fn: async () => {
        expect(0,).toBeFalsy();
        expect('',).toBeFalsy();
        expect(null,).toBeFalsy();
        expect(undefined,).toBeFalsy();
      },
    },),

    it({
      name: 'toBeInstanceOf works',
      fn: async () => {
        expect(new Error('test',),).toBeInstanceOf(Error,);
        expect(new TypeError('test',),).toBeInstanceOf(Error,);
      },
    },),

    it({
      name: 'toBeDefined works',
      fn: async () => {
        expect(1,).toBeDefined();
        expect('hello',).toBeDefined();
        expect(null,).toBeDefined();
      },
    },),

    it({
      name: 'toBeDefined fails for undefined',
      fails: true,
      fn: async () => {
        expect(undefined,).toBeDefined();
      },
    },),

    it({
      name: 'toBeNaN works',
      fn: async () => {
        expect(Number.NaN,).toBeNaN();
      },
    },),

    it({
      name: 'toBeNaN fails for numbers',
      fails: true,
      fn: async () => {
        expect(42,).toBeNaN();
      },
    },),

    //endregion Type checks

    //region Collection matchers

    it({
      name: 'toHaveLength works',
      fn: async () => {
        expect([1, 2, 3,],).toHaveLength(3,);
        expect('hello',).toHaveLength(5,);
      },
    },),

    it({
      name: 'toHaveProperty works without value',
      fn: async () => {
        expect({ a: 1, },).toHaveProperty('a',);
      },
    },),

    it({
      name: 'toHaveProperty works with value',
      fn: async () => {
        expect({ a: 1, },).toHaveProperty('a', 1,);
      },
    },),

    it({
      name: 'toMatch works with regex',
      fn: async () => {
        expect('hello world',).toMatch(/world/,);
      },
    },),

    it({
      name: 'toMatch works with string',
      fn: async () => {
        expect('hello world',).toMatch('world',);
      },
    },),

    it({
      name: 'toMatchObject works',
      fn: async () => {
        expect({ a: 1, b: 2, c: 3, },).toMatchObject({ a: 1, b: 2, },);
      },
    },),

    //endregion Collection matchers

    //region not (negation)

    it({
      name: 'not.toBe works',
      fn: async () => {
        expect(1,).not.toBe(2,);
      },
    },),

    it({
      name: 'not.toBeUndefined works',
      fn: async () => {
        expect(1,).not.toBeUndefined();
      },
    },),

    it({
      name: 'not.toContain works',
      fn: async () => {
        expect([1, 2, 3,],).not.toContain(4,);
      },
    },),

    //endregion not (negation)

    //region rejects

    it({
      name: 'rejects.toThrow passes for rejected promise (no args)',
      fn: async () => {
        await expect(Promise.reject(new Error('boom',),),).rejects.toThrow();
      },
    },),

    it({
      name: 'rejects.toThrow matches error message string',
      fn: async () => {
        await expect(Promise.reject(new Error('specific failure',),),).rejects.toThrow(
          'specific',
        );
      },
    },),

    it({
      name: 'rejects.toThrow matches regex',
      fn: async () => {
        await expect(Promise.reject(new Error('code 42 failed',),),).rejects.toThrow(
          /code \d+ failed/,
        );
      },
    },),

    it({
      name: 'rejects.toThrow matches error class',
      fn: async () => {
        await expect(Promise.reject(new TypeError('bad type',),),).rejects.toThrow(
          TypeError,
        );
      },
    },),

    it({
      name: 'rejects.toThrow fails on message mismatch',
      fails: true,
      fn: async () => {
        await expect(Promise.reject(new Error('actual message',),),).rejects.toThrow(
          'completely different',
        );
      },
    },),

    it({
      name: 'rejects.toThrow fails when promise resolves',
      fails: true,
      fn: async () => {
        await expect(Promise.resolve('ok',),).rejects.toThrow();
      },
    },),

    it({
      name: 'rejects.toBeInstanceOf works',
      fn: async () => {
        await expect(Promise.reject(new TypeError('x',),),).rejects.toBeInstanceOf(
          TypeError,
        );
      },
    },),

    it({
      name: 'rejects.toHaveProperty checks error properties',
      fn: async () => {
        await expect(Promise.reject(new Error('msg',),),).rejects.toHaveProperty(
          'message',
          'msg',
        );
      },
    },),

    //endregion rejects

    //region resolves

    it({
      name: 'resolves.toBe works for resolved value',
      fn: async () => {
        await expect(Promise.resolve(42,),).resolves.toBe(42,);
      },
    },),

    it({
      name: 'resolves.toEqual works for deep equality',
      fn: async () => {
        await expect(Promise.resolve({ a: 1, },),).resolves.toEqual({ a: 1, },);
      },
    },),

    it({
      name: 'resolves.toContain works for substrings',
      fn: async () => {
        await expect(Promise.resolve('hello world',),).resolves.toContain('world',);
      },
    },),
    //endregion resolves
  ],
},);
