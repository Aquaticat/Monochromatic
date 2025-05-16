import {
  logtapeConfiguration,
  logtapeConfigure,
  pipe,
  pipeAsync,
  piped,
  pipedAsync,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('piped', () => {
  test('returns input with no functions', () => {
    expect(piped(5)).toBe(5);
    expect(piped('test')).toBe('test');
  });

  test('applies a single function', () => {
    const addOne = (x: number) => x + 1;
    expect(piped(5, addOne)).toBe(6);
  });

  test('applies multiple functions in sequence', () => {
    const addOne = (x: number) => x + 1;
    const double = (x: number) => x * 2;
    const toString = (x: number) => `${x}`;

    expect(piped(5, addOne, double)).toBe(12);
    expect(piped(5, addOne, double, toString)).toBe('12');
  });

  test('works with object transformations', () => {
    const obj = { value: 5 };
    const increment = (o: typeof obj) => ({ value: o.value + 1 });
    const addProp = (o: ReturnType<typeof increment>) => ({ ...o, added: true });

    expect(piped(obj, increment, addProp)).toEqual({ value: 6, added: true });
  });

  test('handles maximum number of functions', () => {
    const fn1 = (x: number) => x + 1;
    const fn2 = (x: number) => x + 2;
    const fn3 = (x: number) => x + 3;
    const fn4 = (x: number) => x + 4;
    const fn5 = (x: number) => x + 5;
    const fn6 = (x: number) => x + 6;
    const fn7 = (x: number) => x + 7;
    const fn8 = (x: number) => x + 8;
    const fn9 = (x: number) => x + 9;

    expect(piped(0, fn1, fn2, fn3, fn4, fn5, fn6, fn7, fn8, fn9)).toBe(45);
  });
});

describe('pipedAsync', () => {
  test('returns input with no functions', async () => {
    expect(await pipedAsync(5)).toBe(5);
    expect(await pipedAsync('test')).toBe('test');
  });

  test('applies a single async function', async () => {
    const asyncAddOne = async (x: number) => x + 1;
    expect(await pipedAsync(5, asyncAddOne)).toBe(6);
  });

  test('applies multiple async functions in sequence', async () => {
    const asyncAddOne = async (x: number) => x + 1;
    const asyncDouble = async (x: number) => x * 2;
    const asyncToString = async (x: number) => `${x}`;

    expect(await pipedAsync(5, asyncAddOne, asyncDouble)).toBe(12);
    expect(await pipedAsync(5, asyncAddOne, asyncDouble, asyncToString)).toBe('12');
  });

  test('mixes sync and async functions', async () => {
    const syncAddOne = (x: number) => x + 1;
    const asyncDouble = async (x: number) => x * 2;
    const syncToString = (x: number) => `${x}`;

    expect(await pipedAsync(5, syncAddOne, asyncDouble, syncToString)).toBe('12');
  });

  test('handles maximum number of functions', async () => {
    const fn1 = async (x: number) => x + 1;
    const fn2 = (x: number) => x + 2;
    const fn3 = async (x: number) => x + 3;
    const fn4 = (x: number) => x + 4;
    const fn5 = async (x: number) => x + 5;
    const fn6 = (x: number) => x + 6;
    const fn7 = async (x: number) => x + 7;
    const fn8 = (x: number) => x + 8;
    const fn9 = async (x: number) => x + 9;

    expect(await pipedAsync(0, fn1, fn2, fn3, fn4, fn5, fn6, fn7, fn8, fn9)).toBe(45);
  });
});

describe('pipeAsync', () => {
  test('returns original function with no additional functions', async () => {
    const fn = (a: number, b: number) => a + b;
    const piped = pipeAsync(fn);
    expect(piped).toBe(fn);
    expect(piped(1, 2)).toBe(3);
  });

  test('composes sync functions', async () => {
    const add = (a: number, b: number) => a + b;
    const double = (x: number) => x * 2;
    const toString = (x: number) => `${x}`;

    const composed = pipeAsync(add, double, toString);
    expect(typeof composed).toBe('function');
    expect(composed(1, 2)).toBe('6');
  });

  test('composes async functions', async () => {
    const asyncAdd = async (a: number, b: number) => a + b;
    const asyncDouble = async (x: number) => x * 2;

    const composed = pipeAsync(asyncAdd, asyncDouble);
    expect(typeof composed).toBe('function');
    const result = await composed(1, 2);
    expect(result).toBe(6);
  });

  test('mixes sync and async functions', async () => {
    const add = (a: number, b: number) => a + b;
    const asyncDouble = async (x: number) => x * 2;
    const toString = (x: number) => `${x}`;

    const composed = pipeAsync(add, asyncDouble, toString);
    expect(typeof composed).toBe('function');
    const result = await composed(1, 2);
    expect(result).toBe('6');
  });

  test('handles multiple arguments for first function', async () => {
    const concat = (a: string, b: string, c: string) => a + b + c;
    const toUpper = (s: string) => s.toUpperCase();

    const composed = pipeAsync(concat, toUpper);
    expect(composed('a', 'b', 'c')).toBe('ABC');
  });

  test('correctly types return values', async () => {
    const add = (a: number, b: number) => a + b;
    const toString = (x: number) => `${x}`;
    const length = (s: string) => s.length;

    const composed = pipeAsync(add, toString, length);
    const result = composed(10, 20);
    expect(result).toBe(2); // "30" has length 2
  });
});

describe('pipe', () => {
  test('returns original function with no additional functions', () => {
    const fn = (a: number, b: number) => a + b;
    const piped = pipe(fn);
    expect(typeof piped).toBe('function');
    expect(piped(1, 2)).toBe(3);
  });

  test('composes multiple functions', () => {
    const add = (a: number, b: number) => a + b;
    const double = (x: number) => x * 2;
    const toString = (x: number) => `${x}`;

    const composed = pipe(add, double, toString);
    expect(typeof composed).toBe('function');
    expect(composed(1, 2)).toBe('6');
  });

  test('handles multiple arguments for first function', () => {
    const concat = (a: string, b: string, c: string) => a + b + c;
    const toUpper = (s: string) => s.toUpperCase();

    const composed = pipe(concat, toUpper);
    expect(composed('a', 'b', 'c')).toBe('ABC');
  });

  test('correctly preserves types through the pipeline', () => {
    const add = (a: number, b: number) => a + b;
    const toString = (x: number) => `${x}`;
    const length = (s: string) => s.length;

    const composed = pipe(add, toString, length);
    const result = composed(10, 20);
    expect(result).toBe(2);
  });
});
