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
  ensuringFalsy,
  ensuringFalsyAsync,
  ensuringTruthy,
  ensuringTruthyAsync,
  nonThrowing,
  nonThrowingAsync,
  nonThrowingWithFalse,
  nonThrowingWithFalseAsync,
  nonThrowingWithNull,
  nonThrowingWithNullAsync,
} from './function.ensuring.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('ensuringTruthy', () => {
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

describe('ensuringTruthyAsync', () => {
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

describe('ensuringFalsy', () => {
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

describe('ensuringFalsyAsync', () => {
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

describe('nonThrowing', () => {
  test('returns original value when function does not throw', () => {
    const fn = (x: number) => {
      if (x < 0) { throw new Error('Negative number'); }
      return x * 2;
    };
    const safe = nonThrowing(fn);

    expect(safe(5)).toBe(10);
  });

  test('returns null when function throws', () => {
    const fn = (x: number) => {
      if (x < 0) { throw new Error('Negative number'); }
      return x * 2;
    };
    const safe = nonThrowing(fn);

    expect(safe(-5)).toBe(null);
  });

  test('returns custom standIn value when function throws', () => {
    const fn = (x: number) => {
      if (x < 0) { throw new Error('Negative number'); }
      return x * 2;
    };
    const safe = nonThrowing(fn, false);

    expect(safe(-5)).toBe(false);
  });
});

describe('nonThrowingAsync', () => {
  test('returns original value when function does not throw', async () => {
    const fn = async (x: number) => {
      if (x < 0) { throw new Error('Negative number'); }
      return x * 2;
    };
    const safe = nonThrowingAsync(fn);

    expect(await safe(5)).toBe(10);
  });

  test('returns null when function throws', async () => {
    const fn = async (x: number) => {
      if (x < 0) { throw new Error('Negative number'); }
      return x * 2;
    };
    const safe = nonThrowingAsync(fn);

    expect(await safe(-5)).toBe(null);
  });

  test('returns custom standIn value when function throws', async () => {
    const fn = async (x: number) => {
      if (x < 0) { throw new Error('Negative number'); }
      return x * 2;
    };
    const safe = nonThrowingAsync(fn, false);

    expect(await safe(-5)).toBe(false);
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
    expect(safe(-5)).toBe(null);
    expect(safe(5)).toBe(10);
  });

  test('nonThrowingWithNullAsync returns null when function throws', async () => {
    const safe = nonThrowingWithNullAsync(throwingAsyncFn);
    expect(await safe(-5)).toBe(null);
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
