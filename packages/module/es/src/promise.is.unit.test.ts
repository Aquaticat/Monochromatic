import {
  isPromise,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('isPromise', () => {
  test('identifies native Promise objects', () => {
    const promise = Promise.resolve(42);
    expect(isPromise(promise)).toBe(true);
  });

  test('identifies Promise-like objects with then method', () => {
    const thenable = {
      then: () => {
        // no-op
      },
    };
    expect(isPromise(thenable)).toBe(true);
  });

  test('rejects primitives', () => {
    expect(isPromise(undefined)).toBe(false);
    expect(isPromise(null)).toBe(false);
    expect(isPromise(42)).toBe(false);
    expect(isPromise('string')).toBe(false);
    expect(isPromise(true)).toBe(false);
    expect(isPromise(Symbol('test'))).toBe(false);
    expect(isPromise(123n)).toBe(false);
  });

  test('rejects objects without then method', () => {
    expect(isPromise({})).toBe(false);
    expect(isPromise([])).toBe(false);
    expect(isPromise(new Date())).toBe(false);
    expect(isPromise(new Map())).toBe(false);
    expect(isPromise(new Set())).toBe(false);
  });

  test('rejects functions', () => {
    expect(isPromise(() => {
      // no-op
    }))
      .toBe(false);
    expect(isPromise(function() {
      // no-op
    }))
      .toBe(false);
    expect(isPromise(async function() {
      // no-op
    }))
      .toBe(false); // async function itself is not a promise
  });

  test('works with async/await functions', async () => {
    const asyncFn = async () => 42;
    const result = asyncFn(); // This returns a promise
    expect(isPromise(result)).toBe(true);
  });

  test('rejects object with non-function then property', () => {
    expect(isPromise({ then: 'not a function' })).toBe(false);
    expect(isPromise({ then: 42 })).toBe(false);
    expect(isPromise({ then: true })).toBe(false);
    expect(isPromise({ then: {} })).toBe(false);
  });
});
