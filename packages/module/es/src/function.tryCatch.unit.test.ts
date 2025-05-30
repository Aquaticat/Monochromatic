import {
  tryCatch,
  tryCatchAsync,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

describe(tryCatch, () => {
  test('returns the result when tryer succeeds', () => {
    const result = tryCatch(() => 'success', () => false);
    expect(result).toBe('success');
  });

  test('retries and succeeds when catcher returns true', () => {
    let attempts = 0;
    const tryer = vi.fn(() => {
      attempts++;
      if (attempts === 1) {
        throw new Error('first attempt failed');
      }
      return 'success';
    });
    const catcher = vi.fn(() => true);

    const result = tryCatch(tryer, catcher);

    expect(result).toBe('success');
    expect(tryer).toHaveBeenCalledTimes(2);
    expect(catcher).toHaveBeenCalledTimes(1);
  });

  test('throws when catcher returns false', () => {
    const error = new Error('test error');
    const tryer = vi.fn(() => {
      throw error;
    });
    const catcher = vi.fn(() => false);

    expect(() => tryCatch(tryer, catcher)).toThrow(error);
    expect(tryer).toHaveBeenCalledTimes(1);
    expect(catcher).toHaveBeenCalledTimes(1);
  });

  test('throws when retry also fails', () => {
    const error = new Error('test error');
    const tryer = vi.fn(() => {
      throw error;
    });
    const catcher = vi.fn(() => true);

    expect(() => tryCatch(tryer, catcher)).toThrow(error);
    expect(tryer).toHaveBeenCalledTimes(2);
    expect(catcher).toHaveBeenCalledTimes(1);
  });
});

describe(tryCatchAsync, () => {
  test('returns the result when tryer succeeds', async () => {
    const result = await tryCatchAsync(async () => 'success', async () => false);
    expect(result).toBe('success');
  });

  test('retries and succeeds when catcher returns true', async () => {
    let attempts = 0;
    const tryer = vi.fn(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('first attempt failed');
      }
      return 'success';
    });
    const catcher = vi.fn(async () => true);

    const result = await tryCatchAsync(tryer, catcher);

    expect(result).toBe('success');
    expect(tryer).toHaveBeenCalledTimes(2);
    expect(catcher).toHaveBeenCalledTimes(1);
  });

  test('throws when catcher returns false', async () => {
    const error = new Error('test error');
    const tryer = vi.fn(async () => {
      throw error;
    });
    const catcher = vi.fn(async () => false);

    await expect(tryCatchAsync(tryer, catcher)).rejects.toThrow(error);
    expect(tryer).toHaveBeenCalledTimes(1);
    expect(catcher).toHaveBeenCalledTimes(1);
  });

  test('throws when retry also fails', async () => {
    const error = new Error('test error');
    const tryer = vi.fn(async () => {
      throw error;
    });
    const catcher = vi.fn(async () => true);

    await expect(tryCatchAsync(tryer, catcher)).rejects.toThrow(error);
    expect(tryer).toHaveBeenCalledTimes(2);
    expect(catcher).toHaveBeenCalledTimes(1);
  });
});
