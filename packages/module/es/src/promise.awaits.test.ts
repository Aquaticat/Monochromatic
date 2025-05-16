import { awaits } from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe('awaits', () => {
  test('correctly awaits a promise', async () => {
    const promise = Promise.resolve(42);
    const result = await awaits(promise);
    expect(result).toBe(42);
  });

  test('correctly awaits already resolved values', async () => {
    const result = await awaits(42);
    expect(result).toBe(42);
  });

  test('preserves primitive values', async () => {
    expect(await awaits(5)).toBe(5);
    expect(await awaits('test')).toBe('test');
    expect(await awaits(true)).toBe(true);
    expect(await awaits(null)).toBe(null);
    expect(await awaits(undefined)).toBe(undefined);
  });

  test('preserves reference to objects and arrays', async () => {
    const obj = { a: 1, b: 2 };
    const arr = [1, 2, 3];

    expect(await awaits(obj)).toBe(obj);
    expect(await awaits(arr)).toBe(arr);
  });

  test('unwraps nested promises', async () => {
    const nestedPromise = Promise.resolve(Promise.resolve(42));
    const result = await awaits(nestedPromise);
    expect(result).toBe(42);
  });

  test('propagates rejected promises', async () => {
    const error = new Error('Test error');
    const rejectedPromise = Promise.reject(error);

    await expect(awaits(rejectedPromise)).rejects.toThrow('Test error');
  });

  test('handles async function results', async () => {
    const asyncFn = async () => 'async result';
    const result = await awaits(asyncFn());
    expect(result).toBe('async result');
  });

  test("doesn't change the timing of promise resolution", async () => {
    let flag = false;

    const delayedPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        flag = true;
        resolve('done');
      }, 10);
    });

    const awaitedPromise = awaits(delayedPromise);
    expect(flag).toBe(false); // Promise hasn't resolved yet

    const result = await awaitedPromise;
    expect(flag).toBe(true); // Promise has resolved
    expect(result).toBe('done');
  });
});
