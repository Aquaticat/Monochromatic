import {
  binary,
  logtapeConfiguration,
  logtapeConfigure,
  ternary,
  unary,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('unary', () => {
  test('limits a function to taking only one parameter', () => {
    const originalFn = (a: number, b: number, c: number): number => a + b + c;
    const unariedFn = unary(originalFn);

    // The unary function should ignore additional parameters
    // @ts-expect-error - Testing runtime behavior
    expect(unariedFn(1, 2, 3)).toBe(Number.NaN); // Only 1 is passed to originalFn, b and c are undefined
    expect(unariedFn(5)).toBe(Number.NaN); // Only 5 is passed, b and c are undefined
  });

  test('preserves the result type', () => {
    const strFn = (a: string, b: string): string => a + b;
    const unariedStrFn = unary(strFn);

    // @ts-expect-error - Testing runtime behavior
    // noinspection SpellCheckingInspection
    expect(unariedStrFn('hello', 'world')).toBe('helloundefined');
    // noinspection SpellCheckingInspection
    expect(unariedStrFn('hello')).toBe('helloundefined');
  });

  test('works with object types', () => {
    const objFn = (obj: { value: number; }, multiplier: number): number =>
      obj.value * multiplier;
    const unariedObjFn = unary(objFn);

    // @ts-expect-error - Testing runtime behavior
    expect(unariedObjFn({ value: 5 }, 2)).toBe(Number.NaN);
    expect(unariedObjFn({ value: 5 })).toBe(Number.NaN);
  });
});

describe('binary', () => {
  test('limits a function to taking only two parameters', () => {
    const originalFn = (a: number, b: number, c: number): number => a + b + c;
    const binariedFn = binary(originalFn);

    // The binary function should ignore additional parameters
    // @ts-expect-error - Testing runtime behavior
    expect(binariedFn(1, 2, 3)).toBe(Number.NaN); // Only 1 and 2 are passed, c is undefined
    expect(binariedFn(1, 2)).toBe(Number.NaN); // Only 1 and 2 are passed, c is undefined
  });

  test('preserves the result type', () => {
    const strFn = (a: string, b: string, c: string): string => a + b + c;
    const binariedStrFn = binary(strFn);

    // @ts-expect-error - Testing runtime behavior
    // noinspection SpellCheckingInspection
    expect(binariedStrFn('hello', 'world', '!')).toBe('helloworldundefined');
    // noinspection SpellCheckingInspection
    expect(binariedStrFn('hello', 'world')).toBe('helloworldundefined');
  });

  test('works with mixed types', () => {
    const mixedFn = (str: string, num: number, bool: boolean): string =>
      `${str}${num}${bool}`;
    const binariedMixedFn = binary(mixedFn);

    // @ts-expect-error - Testing runtime behavior
    expect(binariedMixedFn('test', 42, true)).toBe('test42undefined');
    expect(binariedMixedFn('test', 42)).toBe('test42undefined');
  });
});

describe('ternary', () => {
  test('limits a function to taking only three parameters', () => {
    const originalFn = (a: number, b: number, c: number, d: number): number =>
      a + b + c + d;
    const ternariedFn = ternary(originalFn);

    // The ternary function should ignore additional parameters
    // @ts-expect-error - Testing runtime behavior
    expect(ternariedFn(1, 2, 3, 4)).toBe(Number.NaN); // Only 1, 2, and 3 are passed, d is undefined
    expect(ternariedFn(1, 2, 3)).toBe(Number.NaN); // Only 1, 2, and 3 are passed, d is undefined
  });

  test('preserves the result type', () => {
    const strFn = (a: string, b: string, c: string, d: string): string => a + b + c + d;
    const ternariedStrFn = ternary(strFn);

    // @ts-expect-error - Testing runtime behavior
    // noinspection SpellCheckingInspection
    expect(ternariedStrFn('a', 'b', 'c', 'd')).toBe('abcundefined');
    // noinspection SpellCheckingInspection
    expect(ternariedStrFn('a', 'b', 'c')).toBe('abcundefined');
  });

  test('works with mixed parameter types', () => {
    const complexFn = (a: string, b: number, c: boolean, d: object): string =>
      `${a}${b}${c}${JSON.stringify(d)}`;
    const ternariedComplexFn = ternary(complexFn);

    // @ts-expect-error - Testing runtime behavior
    // noinspection SpellCheckingInspection
    expect(ternariedComplexFn('test', 42, true, { x: 1 })).toBe('test42trueundefined');
    // noinspection SpellCheckingInspection
    expect(ternariedComplexFn('test', 42, true)).toBe('test42trueundefined');
  });
});

describe('unary with async functions', () => {
  test('works with async functions', async () => {
    const originalAsyncFn = async (a: number, b: number): Promise<number> => a + b;
    const unariedAsyncFn = unary(originalAsyncFn);

    // @ts-expect-error - Testing runtime behavior
    const result = await unariedAsyncFn(5, 10);
    expect(result).toBe(Number.NaN); // Only 5 is passed, b is undefined

    const singleResult = await unariedAsyncFn(5);
    expect(singleResult).toBe(Number.NaN); // Only 5 is passed, b is undefined
  });

  test('preserves the Promise return type', async () => {
    const asyncFn = async (text: string): Promise<string> => `Hello ${text}`;
    const unariedAsyncFn = unary(asyncFn);

    const result = await unariedAsyncFn('world');
    expect(result).toBe('Hello world');
    expect(unariedAsyncFn('test') instanceof Promise).toBe(true);
  });
});

describe('binary with async functions', () => {
  test('works with async functions', async () => {
    const originalAsyncFn = async (a: number, b: number, c: number): Promise<number> =>
      a + b + c;
    const binariedAsyncFn = binary(originalAsyncFn);

    // @ts-expect-error - Testing runtime behavior
    const result = await binariedAsyncFn(5, 10, 15);
    expect(result).toBe(Number.NaN); // Only 5 and 10 are passed, c is undefined

    const regularResult = await binariedAsyncFn(5, 10);
    expect(regularResult).toBe(Number.NaN); // Only 5 and 10 are passed, c is undefined
  });

  test('preserves the Promise return type', async () => {
    const asyncFn = async (a: string, b: string): Promise<string> => `${a} ${b}`;
    const binariedAsyncFn = binary(asyncFn);

    const result = await binariedAsyncFn('Hello', 'world');
    expect(result).toBe('Hello world');
    expect(binariedAsyncFn('Hello', 'test') instanceof Promise).toBe(true);
  });

  test('properly handles promise resolutions', async () => {
    const delayedFn = async (ms: number, value: string): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return value;
    };

    const binariedDelayedFn = binary(delayedFn);
    const result = await binariedDelayedFn(10, 'fast operation');

    expect(result).toBe('fast operation');
  });
});

describe('ternary with async functions', () => {
  test('works with async functions', async () => {
    const originalAsyncFn = async (a: number, b: number, c: number,
      d: number): Promise<number> => a + b + c + d;
    const ternariedAsyncFn = ternary(originalAsyncFn);

    // @ts-expect-error - Testing runtime behavior
    const result = await ternariedAsyncFn(5, 10, 15, 20);
    expect(result).toBe(Number.NaN); // Only 5, 10, and 15 are passed, d is undefined

    const regularResult = await ternariedAsyncFn(5, 10, 15);
    expect(regularResult).toBe(Number.NaN); // Only 5, 10, and 15 are passed, d is undefined
  });

  test('preserves the Promise return type', async () => {
    const asyncFn = async (a: string, b: string, c: string): Promise<string> =>
      `${a} ${b} ${c}`;
    const ternariedAsyncFn = ternary(asyncFn);

    const result = await ternariedAsyncFn('Hello', 'beautiful', 'world');
    expect(result).toBe('Hello beautiful world');
    expect(ternariedAsyncFn('Hello', 'test', 'case') instanceof Promise).toBe(true);
  });

  test('works with mixed async parameter types', async () => {
    const complexAsyncFn = async (
      str: string,
      num: number,
      bool: boolean,
    ): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return `${str}-${num}-${bool}`;
    };

    const ternariedComplexFn = ternary(complexAsyncFn);
    const result = await ternariedComplexFn('test', 42, true);

    expect(result).toBe('test-42-true');
  });
});
