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
  addBigints,
  addBigintsAsync,
  addNumbers,
  addNumbersAsync,
  addNumerics,
  addNumericsAsync,
} from './numeric.add.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('addNumbers', () => {
  test('adds an array of numbers', () => {
    expect(addNumbers([1, 2, 3, 4])).toBe(10);
    expect(addNumbers([0, -5, 10])).toBe(5);
    expect(addNumbers([])).toBe(0);
  });

  test('adds numbers as arguments', () => {
    expect(addNumbers(1, 2, 3, 4)).toBe(10);
    expect(addNumbers(0, -5, 10)).toBe(5);
    expect(addNumbers()).toBe(0);
  });
});

describe('addNumbersAsync', () => {
  test('adds an array of numbers asynchronously', async () => {
    expect(await addNumbersAsync([1, 2, 3, 4])).toBe(10);
    expect(await addNumbersAsync([0, -5, 10])).toBe(5);
    expect(await addNumbersAsync([])).toBe(0);
  });

  test('adds numbers as arguments asynchronously', async () => {
    expect(await addNumbersAsync(1, 2, 3, 4)).toBe(10);
    expect(await addNumbersAsync(0, -5, 10)).toBe(5);
    expect(await addNumbersAsync()).toBe(0);
  });

  test('works with async iterables', async () => {
    async function* generateNumbers() {
      yield 1;
      yield 2;
      yield 3;
    }
    expect(await addNumbersAsync(generateNumbers())).toBe(6);
  });
});

describe('addBigints', () => {
  test('adds an array of bigints', () => {
    expect(addBigints([1n, 2n, 3n, 4n])).toBe(10n);
    expect(addBigints([0n, -5n, 10n])).toBe(5n);
    expect(addBigints([])).toBe(0n);
  });

  test('adds bigints as arguments', () => {
    expect(addBigints(1n, 2n, 3n, 4n)).toBe(10n);
    expect(addBigints(0n, -5n, 10n)).toBe(5n);
    expect(addBigints()).toBe(0n);
  });
});

describe('addBigintsAsync', () => {
  test('adds an array of bigints asynchronously', async () => {
    expect(await addBigintsAsync([1n, 2n, 3n, 4n])).toBe(10n);
    expect(await addBigintsAsync([0n, -5n, 10n])).toBe(5n);
    expect(await addBigintsAsync([])).toBe(0n);
  });

  test('adds bigints as arguments asynchronously', async () => {
    expect(await addBigintsAsync(1n, 2n, 3n, 4n)).toBe(10n);
    expect(await addBigintsAsync(0n, -5n, 10n)).toBe(5n);
    expect(await addBigintsAsync()).toBe(0n);
  });

  test('works with async iterables', async () => {
    async function* generateBigints() {
      yield 1n;
      yield 2n;
      yield 3n;
    }
    expect(await addBigintsAsync(generateBigints())).toBe(6n);
  });
});

describe('addNumerics', () => {
  test('adds an array of numbers', () => {
    expect(addNumerics([1, 2, 3, 4])).toBe(10);
    expect(addNumerics([-5, 10, -2])).toBe(3);
  });

  test('adds numbers as arguments', () => {
    expect(addNumerics(1, 2, 3, 4)).toBe(10);
    expect(addNumerics(-5, 10, -2)).toBe(3);
  });

  test('adds an array of bigints', () => {
    expect(addNumerics([1n, 2n, 3n, 4n])).toBe(10);
    expect(addNumerics([-5n, 10n])).toBe(5);
  });

  test('adds bigints as arguments', () => {
    expect(addNumerics(1n, 2n, 3n, 4n)).toBe(10);
    expect(addNumerics(-5n, 10n)).toBe(5);
  });

  test('converts to bigint when mixing types', () => {
    expect(addNumerics([1, 2, 3n])).toBe(6);
    expect(addNumerics(1, 2, 3n)).toBe(6);
  });

  test('handles empty arrays', () => {
    expect(addNumerics([])).toBe(0);
    expect(addNumerics()).toBe(0);
  });
});

describe('addNumericsAsync', () => {
  test('adds an array of numbers asynchronously', async () => {
    expect(await addNumericsAsync([1, 2, 3, 4])).toBe(10);
    expect(await addNumericsAsync([-5, 10, -2])).toBe(3);
  });

  test('adds numbers as arguments asynchronously', async () => {
    expect(await addNumericsAsync(1, 2, 3, 4)).toBe(10);
    expect(await addNumericsAsync(-5, 10, -2)).toBe(3);
  });

  test('adds an array of bigints asynchronously', async () => {
    expect(await addNumericsAsync([1n, 2n, 3n, 4n])).toBe(10);
    expect(await addNumericsAsync([-5n, 10n])).toBe(5);
  });

  test('adds bigints as arguments asynchronously', async () => {
    expect(await addNumericsAsync(1n, 2n, 3n, 4n)).toBe(10);
    expect(await addNumericsAsync(-5n, 10n)).toBe(5);
  });

  test('converts to bigint when mixing types asynchronously', async () => {
    expect(await addNumericsAsync([1, 2, 3n])).toBe(6);
    expect(await addNumericsAsync(1, 2, 3n)).toBe(6);
  });

  test('works with async iterables', async () => {
    async function* generateMixed() {
      yield 1;
      yield 2;
      yield 3n;
    }
    expect(await addNumericsAsync(generateMixed()) as number).toBe(6);
  });

  test('handles empty arrays asynchronously', async () => {
    expect(await addNumericsAsync([])).toBe(0);
    expect(await addNumericsAsync()).toBe(0);
  });
});
