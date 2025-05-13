import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'vitest';
import {
  booleanfy,
  booleanfyAsync,
} from './function.booleanfy.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('booleanfy', () => {
  test('converts truthy return values to true', () => {
    const fn1 = booleanfy(() => 'string');
    const fn2 = booleanfy(() => 42);
    const fn3 = booleanfy(() => ({ key: 'value' }));
    const fn4 = booleanfy(() => [1, 2, 3]);

    expect(fn1()).toBe(true);
    expect(fn2()).toBe(true);
    expect(fn3()).toBe(true);
    expect(fn4()).toBe(true);
  });

  test('converts falsy return values to false', () => {
    const fn1 = booleanfy(() => '');
    const fn2 = booleanfy(() => 0);
    const fn3 = booleanfy(() => null);
    const fn4 = booleanfy(() => undefined);
    const fn5 = booleanfy(() => false);

    expect(fn1()).toBe(false);
    expect(fn2()).toBe(false);
    expect(fn3()).toBe(false);
    expect(fn4()).toBe(false);
    expect(fn5()).toBe(false);
  });

  test('preserves function arguments', () => {
    const fn = booleanfy((a: number, b: string) => a > 10 && b === 'test');

    expect(fn(5, 'test')).toBe(false);
    expect(fn(15, 'test')).toBe(true);
    expect(fn(15, 'wrong')).toBe(false);
  });

  test('wraps returned value with Boolean()', () => {
    // This is to test that Boolean() is actually used, not a simple !! operator
    // eslint-disable new-for-builtins,no-new-wrappers
    // noinspection JSPrimitiveTypeWrapperUsage
    const fn = booleanfy(() => new Boolean(false));
    // eslint-enable new-for-builtins,no-new-wrappers
    expect(fn()).toBe(true); // Boolean objects are always truthy
  });
});

describe('booleanfyAsync', () => {
  test('converts truthy return values to true', async () => {
    const fn1 = booleanfyAsync(async () => 'string');
    const fn2 = booleanfyAsync(async () => 42);
    const fn3 = booleanfyAsync(async () => ({ key: 'value' }));
    const fn4 = booleanfyAsync(async () => [1, 2, 3]);

    expect(await fn1()).toBe(true);
    expect(await fn2()).toBe(true);
    expect(await fn3()).toBe(true);
    expect(await fn4()).toBe(true);
  });

  test('converts falsy return values to false', async () => {
    const fn1 = booleanfyAsync(async () => '');
    const fn2 = booleanfyAsync(async () => 0);
    const fn3 = booleanfyAsync(async () => null);
    const fn4 = booleanfyAsync(async () => undefined);
    const fn5 = booleanfyAsync(async () => false);

    expect(await fn1()).toBe(false);
    expect(await fn2()).toBe(false);
    expect(await fn3()).toBe(false);
    expect(await fn4()).toBe(false);
    expect(await fn5()).toBe(false);
  });

  test('preserves function arguments', async () => {
    const fn = booleanfyAsync(async (a: number, b: string) => a > 10 && b === 'test');

    expect(await fn(5, 'test')).toBe(false);
    expect(await fn(15, 'test')).toBe(true);
    expect(await fn(15, 'wrong')).toBe(false);
  });

  test('works with both sync and async functions', async () => {
    const syncFn = booleanfyAsync(() => true);
    const asyncFn = booleanfyAsync(async () => true);

    expect(await syncFn()).toBe(true);
    expect(await asyncFn()).toBe(true);
  });

  test('properly awaits promises', async () => {
    const fn = booleanfyAsync(() => Promise.resolve(false));
    expect(await fn()).toBe(false);

    const delayedFn = booleanfyAsync(async () => {
      // Simulating async operation
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });
    expect(await delayedFn()).toBe(true);
  });
});
