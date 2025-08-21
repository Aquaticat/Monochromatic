import { simpleMemoize, } from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

describe(simpleMemoize, () => {
  test('returns the same result for identical arguments', () => {
    const fn = vi.fn((x: number,) => x * 2);
    const memoizedFn = simpleMemoize(fn,);

    expect(memoizedFn(5,),).toBe(10,);
    expect(memoizedFn(5,),).toBe(10,);
    expect(fn,).toHaveBeenCalledTimes(1,);
  });

  test('calculates new result for different arguments', () => {
    const fn = vi.fn((x: number,) => x * 2);
    const memoizedFn = simpleMemoize(fn,);

    expect(memoizedFn(5,),).toBe(10,);
    expect(memoizedFn(6,),).toBe(12,);
    expect(fn,).toHaveBeenCalledTimes(2,);
  });

  test('works with multiple arguments', () => {
    const fn = vi.fn((a: number, b: number,) => a + b);
    const memoizedFn = simpleMemoize(fn,);

    expect(memoizedFn(1, 2,),).toBe(3,);
    expect(memoizedFn(1, 2,),).toBe(3,);
    expect(memoizedFn(2, 1,),).toBe(3,);
    expect(fn,).toHaveBeenCalledTimes(2,); // Different args
  });

  test('does not handle object arguments because it uses Object.is', () => {
    const fn = vi.fn((obj: { a: number; },) => obj.a * 2);
    const memoizedFn = simpleMemoize(fn,);

    expect(memoizedFn({ a: 5, },),).toBe(10,);
    expect(memoizedFn({ a: 5, },),).toBe(10,);
    expect(fn,).toHaveBeenCalledTimes(2,);
  });

  test('throws when inner function throws', () => {
    const fn = vi.fn(() => {
      throw new Error('Test error',);
    },);
    const memoizedFn = simpleMemoize(fn,);

    expect(() => memoizedFn()).toThrow('Test error',);
  });

  test('supports asynchronous functions', async () => {
    const fn = vi.fn(async (x: number,) => (x * 2));
    const memoizedFn = simpleMemoize(fn,);

    await expect(memoizedFn(5,),).resolves.toBe(10,);
    await expect(memoizedFn(5,),).resolves.toBe(10,);
    expect(fn,).toHaveBeenCalledTimes(1,);
  });

  test('only memoizes the last call', () => {
    const fn = vi.fn((x: number,) => x * 2);
    const memoizedFn = simpleMemoize(fn,);

    expect(memoizedFn(5,),).toBe(10,);
    expect(memoizedFn(6,),).toBe(12,); // Different args
    expect(memoizedFn(5,),).toBe(10,); // Back to first args, but cache was replaced
    expect(fn,).toHaveBeenCalledTimes(3,);
  });

  test('handles complex nested arguments', () => {
    const fn = vi.fn(obj => JSON.stringify(obj,));
    const memoizedFn = simpleMemoize(fn,);

    const complex = { a: [1, 2, { c: 3, },], b: { d: 4, }, };
    const result = JSON.stringify(complex,);

    expect(memoizedFn(complex,),).toBe(result,);
    expect(memoizedFn(complex,),).toBe(result,);
    expect(fn,).toHaveBeenCalledTimes(1,);
  });
},);
