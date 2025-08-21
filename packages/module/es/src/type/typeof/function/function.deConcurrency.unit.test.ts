import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { deConcurrency, } from './function.deConcurrency';

describe('deConcurrency', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  },);

  afterEach(() => {
    vi.useRealTimers();
  },);

  it('should execute function normally when not running concurrently', async () => {
    const mockFn = vi.fn().mockResolvedValue('result',);
    const debouncedFn = deConcurrency(mockFn,);

    const result = await debouncedFn();
    expect(result,).toBe('result',);
    expect(mockFn,).toHaveBeenCalledTimes(1,);
  });

  it('should prevent concurrent execution', async () => {
    const mockFn = vi.fn().mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve('result',), 100,);
      },);
    },);
    const debouncedFn = deConcurrency(mockFn,);

    // Start first execution
    const promise1 = debouncedFn();

    // Try to start second execution while first is still running
    const promise2 = debouncedFn();

    // Advance timers to resolve the first execution
    await vi.advanceTimersByTimeAsync(100,);

    const result1 = await promise1;
    const result2 = await promise2;

    // Both should return the same result
    expect(result1,).toBe('result',);
    expect(result2,).toBe('result',);

    // But function should only be called once
    expect(mockFn,).toHaveBeenCalledTimes(1,);
  });

  it('should allow execution after previous execution completes', async () => {
    const mockFn = vi.fn().mockResolvedValue('result',);
    const debouncedFn = deConcurrency(mockFn,);

    await debouncedFn();
    await debouncedFn();

    expect(mockFn,).toHaveBeenCalledTimes(2,);
  });

  it('should handle function with parameters', async () => {
    const mockFn = vi.fn().mockImplementation((a: number, b: number,) => {
      return Promise.resolve(a + b,);
    },);
    const debouncedFn = deConcurrency(mockFn,);

    const result = await debouncedFn(2, 3,);
    expect(result,).toBe(5,);
    expect(mockFn,).toHaveBeenCalledWith(2, 3,);
  });

  it('should handle rejected promises', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('test error',),);
    const debouncedFn = deConcurrency(mockFn,);

    await expect(debouncedFn(),).rejects.toThrow('test error',);
    expect(mockFn,).toHaveBeenCalledTimes(1,);
  });
});
