import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'bun:test';
import {
  isAsyncFunction,
  isSyncFunction,
} from './function.is.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('isAsyncFunction', () => {
  test('returns true for async functions', () => {
    const asyncFn = async () => 42;
    expect(isAsyncFunction(asyncFn)).toBe(true);
  });

  test('returns false for sync functions', () => {
    const syncFn = () => 42;
    expect(isAsyncFunction(syncFn)).toBe(false);
  });

  test('returns false for arrow functions that return promises', () => {
    const promiseFn = () => Promise.resolve(42);
    expect(isAsyncFunction(promiseFn)).toBe(false);
  });

  test('works with functions that take parameters', () => {
    const asyncFnWithParams = async (a: number, b: string) => `${a}${b}`;
    expect(isAsyncFunction(asyncFnWithParams)).toBe(true);
  });
});

describe('isSyncFunction', () => {
  test('returns true for sync functions', () => {
    const syncFn = () => 42;
    expect(isSyncFunction(syncFn)).toBe(true);
  });

  test('returns true for arrow functions that return promises', () => {
    const promiseFn = () => Promise.resolve(42);
    expect(isSyncFunction(promiseFn)).toBe(true);
  });

  test('returns false for async functions', () => {
    const asyncFn = async () => 42;
    expect(isSyncFunction(asyncFn)).toBe(false);
  });

  test('works with functions that take parameters', () => {
    const syncFnWithParams = (a: number, b: string) => `${a}${b}`;
    expect(isSyncFunction(syncFnWithParams)).toBe(true);
  });
});

describe('function type inference', () => {
  test('isAsyncFunction narrows type correctly', () => {
    const unknownFn = Math.random() > 0.5
      ? async () => 42
      : () => 42;

    if (isAsyncFunction(unknownFn)) {
      // If this compiles, the type narrowing works
      const result = unknownFn().then((val) => val);
      expect(typeof result.then).toBe('function');
    } else {
      // Type is narrowed to sync function
      const result = unknownFn();
      expect(typeof result).toBe('number');
    }
  });

  test('isSyncFunction narrows type correctly', () => {
    const unknownFn = Math.random() > 0.5
      ? async () => 42
      : () => 42;

    if (isSyncFunction(unknownFn)) {
      // If this compiles, the type narrowing works
      const result = unknownFn();
      expect(typeof result).toBe('number');
    } else {
      // Type is narrowed to async function
      const result = unknownFn().then((val) => val);
      expect(typeof result.then).toBe('function');
    }
  });
});
