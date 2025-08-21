import {
  emptyFunction,
  emptyFunctionAsync,
  isAsyncFunction,
  isSyncFunction,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(isAsyncFunction, () => {
  test('returns true for async functions', () => {
    const asyncFn = async () => 42;
    expect(isAsyncFunction(asyncFn,),).toBe(true,);
  });

  test('returns false for sync functions', () => {
    const syncFn = () => 42;
    expect(isAsyncFunction(syncFn,),).toBe(false,);
  });

  test('returns false for arrow functions that return promises', () => {
    const promiseFn = () => Promise.resolve(42,);
    expect(isAsyncFunction(promiseFn,),).toBe(false,);
  });

  test('works with functions that take parameters', () => {
    const asyncFnWithParams = async (a: number, b: string,) => `${a}${b}`;
    expect(isAsyncFunction(asyncFnWithParams,),).toBe(true,);
  });
},);

describe(isSyncFunction, () => {
  test('returns true for sync functions', () => {
    const syncFn = () => 42;
    expect(isSyncFunction(syncFn,),).toBe(true,);
  });

  test('returns true for arrow functions that return promises', () => {
    const promiseFn = () => Promise.resolve(42,);
    expect(isSyncFunction(promiseFn,),).toBe(true,);
  });

  test('returns false for async functions', () => {
    const asyncFn = async () => 42;
    expect(isSyncFunction(asyncFn,),).toBe(false,);
  });

  test('works with functions that take parameters', () => {
    const syncFnWithParams = (a: number, b: string,) => `${a}${b}`;
    expect(isSyncFunction(syncFnWithParams,),).toBe(true,);
  });
},);

describe('function type inference', () => {
  test('isAsyncFunction narrows type correctly', () => {
    const unknownFn = Math.random() > 0.5
      ? async () => 42
      : () => 42;

    if (isAsyncFunction(unknownFn,)) {
      // If this compiles, the type narrowing works
      const result = unknownFn().then(val => val);
      expect(typeof result.then,).toBe('function',);
    }
    else {
      // Type is narrowed to sync function
      const result = unknownFn();
      expect(typeof result,).toBe('number',);
    }
  });

  test('isSyncFunction narrows type correctly', () => {
    const unknownFn = Math.random() > 0.5
      ? async () => 42
      : () => 42;

    if (isSyncFunction(unknownFn,)) {
      // If this compiles, the type narrowing works
      const result = unknownFn();
      expect(typeof result,).toBe('number',);
    }
    else {
      // Type is narrowed to async function
      const result = unknownFn().then(val => val);
      expect(typeof result.then,).toBe('function',);
    }
  });
});

describe(emptyFunction, () => {
  test('performs no operation and returns undefined', () => {
    const result = emptyFunction();
    expect(result,).toBeUndefined();
  });

  test('can be called multiple times without side effects', () => {
    expect(() => {
      emptyFunction();
      emptyFunction();
      emptyFunction();
    },)
      .not
      .toThrow();
  });

  test('accepts any arguments without error', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (emptyFunction as any)(1, 'test', { foo: 'bar', }, [1, 2, 3,],);
    },)
      .not
      .toThrow();
  });
},);

describe(emptyFunctionAsync, () => {
  test('performs no operation and resolves to undefined', async () => {
    const result = await emptyFunctionAsync();
    expect(result,).toBeUndefined();
  });

  test('returns a promise', () => {
    const result = emptyFunctionAsync();
    expect(result,).toBeInstanceOf(Promise,);
  });

  test('can be called multiple times without side effects', async () => {
    await expect(Promise.all([
      emptyFunctionAsync(),
      emptyFunctionAsync(),
      emptyFunctionAsync(),
    ],),)
      .resolves
      .toEqual([undefined, undefined, undefined,],);
  });

  test('accepts any arguments without error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (emptyFunctionAsync as any)(1, 'test', { foo: 'bar', }, [
      1,
      2,
      3,
    ],);
    expect(result,).toBeUndefined();
  });
},);
