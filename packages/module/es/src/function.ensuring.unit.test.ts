import {
  ensuringFalsy,
  ensuringFalsyAsync,
  ensuringTruthy,
  ensuringTruthyAsync,
  logtapeConfiguration,
  logtapeConfigure,
  nonThrowingWithFalse,
  nonThrowingWithFalseAsync,
  nonThrowingWithNull,
  nonThrowingWithNullAsync,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(ensuringTruthy, () => {
  test('returns original value when truthy', () => {
    const fn = (x: number) => x > 0 ? 'positive' : '';
    const ensured = ensuringTruthy(fn);

    expect(ensured(5)).toBe('positive');
  });

  test('throws when result is falsy', () => {
    const fn = (x: number) => x > 0 ? 'positive' : '';
    const ensured = ensuringTruthy(fn);

    expect(() => ensured(-1)).toThrow('Function must return a truthy value');
  });

  test('throws with custom error message', () => {
    const fn = (x: number) => x > 0 ? 'positive' : '';
    const ensured = ensuringTruthy(fn, 'Custom error');

    expect(() => ensured(-1)).toThrow('Custom error');
  });
});

describe(ensuringTruthyAsync, () => {
  test('returns original value when truthy', async () => {
    const fn = async (x: number) => x > 0 ? 'positive' : '';
    const ensured = ensuringTruthyAsync(fn);

    expect(await ensured(5)).toBe('positive');
  });

  test('throws when result is falsy', async () => {
    const fn = async (x: number) => x > 0 ? 'positive' : '';
    const ensured = ensuringTruthyAsync(fn);

    await expect(ensured(-1)).rejects.toThrow('Function must return a truthy value');
  });

  test('throws with custom error message', async () => {
    const fn = async (x: number) => x > 0 ? 'positive' : '';
    const ensured = ensuringTruthyAsync(fn, 'Custom error');

    await expect(ensured(-1)).rejects.toThrow('Custom error');
  });
});

describe(ensuringFalsy, () => {
  test('returns original value when falsy', () => {
    const fn = (x: number) => x < 0 ? '' : 'non-negative';
    const ensured = ensuringFalsy(fn);

    expect(ensured(-1)).toBe('');
  });

  test('throws when result is truthy', () => {
    const fn = (x: number) => x < 0 ? '' : 'non-negative';
    const ensured = ensuringFalsy(fn);

    expect(() => ensured(5)).toThrow('Function must return a falsy value');
  });

  test('throws with custom error message', () => {
    const fn = (x: number) => x < 0 ? '' : 'non-negative';
    const ensured = ensuringFalsy(fn, 'Custom error');

    expect(() => ensured(5)).toThrow('Custom error');
  });
});

describe(ensuringFalsyAsync, () => {
  test('returns original value when falsy', async () => {
    const fn = async (x: number) => x < 0 ? '' : 'non-negative';
    const ensured = ensuringFalsyAsync(fn);

    expect(await ensured(-1)).toBe('');
  });

  test('throws when result is truthy', async () => {
    const fn = async (x: number) => x < 0 ? '' : 'non-negative';
    const ensured = ensuringFalsyAsync(fn);

    await expect(ensured(5)).rejects.toThrow('Function must return a falsy value');
  });

  test('throws with custom error message', async () => {
    const fn = async (x: number) => x < 0 ? '' : 'non-negative';
    const ensured = ensuringFalsyAsync(fn, 'Custom error');

    await expect(ensured(5)).rejects.toThrow('Custom error');
  });
});

describe('nonThrowing convenience wrappers', () => {
  const throwingFn = (x: number) => {
    if (x < 0) { throw new Error('Negative number'); }
    return x * 2;
  };

  const throwingAsyncFn = async (x: number) => {
    if (x < 0) { throw new Error('Negative number'); }
    return x * 2;
  };

  test('nonThrowingWithNull returns null when function throws', () => {
    const safe = nonThrowingWithNull(throwingFn);

    expect(safe(-5)).toBeNull();
    expect(safe(5)).toBe(10);
  });

  test('nonThrowingWithNullAsync returns null when function throws', async () => {
    const safe = nonThrowingWithNullAsync(throwingAsyncFn);

    expect(await safe(-5)).toBeNull();
    expect(await safe(5)).toBe(10);
  });

  test('nonThrowingWithFalse returns false when function throws', () => {
    const safe = nonThrowingWithFalse(throwingFn);

    expect(safe(-5)).toBe(false);
    expect(safe(5)).toBe(10);
  });

  test('nonThrowingWithFalseAsync returns false when function throws', async () => {
    const safe = nonThrowingWithFalseAsync(throwingAsyncFn);

    expect(await safe(-5)).toBe(false);
    expect(await safe(5)).toBe(10);
  });
});
