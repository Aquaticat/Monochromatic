import {
  logtapeConfiguration,
  logtapeConfigure,
  thunk,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(thunk, () => {
  test('delays execution of functions', () => {
    const mockFn = vi.fn(() => 'result');
    const thunked = thunk(mockFn,);

    // Function shouldn't be called yet
    expect(mockFn,).not.toHaveBeenCalled();

    // Function is called when thunked is invoked
    const result = thunked();
    expect(mockFn,).toHaveBeenCalledTimes(1,);
    expect(result,).toBe('result',);
  });

  test('supports functions with parameters', () => {
    const add = (a: number, b: number,) => a + b;
    const thunked = thunk(add,);

    expect(thunked(3, 4,),).toBe(7,);
    expect(thunked(10, 20,),).toBe(30,);
  });

  test('supports async functions', async () => {
    const asyncFn = async (prefix: string,) => `${prefix} result`;
    const thunked = thunk(asyncFn,);

    const result = await thunked('async',);
    expect(result,).toBe('async result',);
  });

  test('supports multiple calls to the thunked function', () => {
    let counter = 0;
    const incrementFn = (amount: number,) => {
      counter += amount;
      return counter;
    };
    const thunked = thunk(incrementFn,);

    expect(thunked(1,),).toBe(1,);
    expect(thunked(2,),).toBe(3,);
    expect(thunked(3,),).toBe(6,);
  });

  test('supports functions with default parameters', () => {
    const greet = (name = 'Anonymous',) => `Hello, ${name}!`;
    const thunked = thunk(greet,);

    expect(thunked(),).toBe('Hello, Anonymous!',);
    expect(thunked('John',),).toBe('Hello, John!',);
  });

  test('supports variadic functions', () => {
    const sum = (...nums: number[]) => nums.reduce((a, b,) => a + b, 0,);
    const thunked = thunk(sum,);

    expect(thunked(1, 2, 3,),).toBe(6,);
    expect(thunked(10,),).toBe(10,);
    expect(thunked(),).toBe(0,);
  });

  test('can accept functions that return undefined', () => {
    const sideEffect = vi.fn();
    const fn = (param: string,) => {
      sideEffect(param,);
      return undefined;
    };
    const thunked = thunk(fn,);

    const result = thunked('test',);
    expect(sideEffect,).toHaveBeenCalledWith('test',);
    expect(result,).toBeUndefined();
  });
},);
