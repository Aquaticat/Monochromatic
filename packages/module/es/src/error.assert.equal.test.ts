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
  assert,
  assert0,
  assert0Async,
  assert1,
  assert1Async,
  assertAsync,
  assertEmptyArray,
  assertEmptyArrayAsync,
  assertEmptyObject,
  assertEmptyObjectAsync,
  assertFalse,
  assertFalseAsync,
  assertNan,
  assertNanAsync,
  assertNegative1,
  assertNegative1Async,
  assertNull,
  assertNullAsync,
  assertTrue,
  assertTrueAsync,
  assertUndefined,
  assertUndefinedAsync,
} from './error.assert.equal.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('synchronous assertions', () => {
  test('assert compares values correctly', () => {
    expect(() => assert(42, 42)).not.toThrow();
    expect(() => assert('test', 'test')).not.toThrow();
    expect(() => assert(null, null)).not.toThrow();

    expect(() => assert(42, 43)).toThrow();
    expect(() => assert('test', 'other')).toThrow();
  });

  test('assertTrue verifies true values', () => {
    expect(() => assertTrue(true)).not.toThrow();
    expect(() => assertTrue(false)).toThrow();
  });

  test('assertFalse verifies false values', () => {
    expect(() => assertFalse(false)).not.toThrow();
    expect(() => assertFalse(true)).toThrow();
  });

  test('assertUndefined verifies undefined values', () => {
    expect(() => assertUndefined(undefined)).not.toThrow();
    expect(() => assertUndefined(null)).toThrow();
    expect(() => assertUndefined(0)).toThrow();
  });

  test('assertNull verifies null values', () => {
    expect(() => assertNull(null)).not.toThrow();
    expect(() => assertNull(undefined)).toThrow();
    expect(() => assertNull(0)).toThrow();
  });

  test('assertEmptyArray verifies empty arrays', () => {
    expect(() => assertEmptyArray([])).not.toThrow();
    expect(() => assertEmptyArray([1, 2])).toThrow();
    expect(() => assertEmptyArray({})).toThrow();
  });

  test('assertEmptyObject verifies empty objects', () => {
    expect(() => assertEmptyObject({})).not.toThrow();
    expect(() => assertEmptyObject({ a: 1 })).toThrow();
    expect(() => assertEmptyObject([])).toThrow();
  });

  test('assert0 verifies zero values', () => {
    expect(() => assert0(0)).not.toThrow();
    expect(() => assert0(1)).toThrow();
    expect(() => assert0('0')).toThrow();
  });

  test('assert1 verifies one values', () => {
    expect(() => assert1(1)).not.toThrow();
    expect(() => assert1(0)).toThrow();
    expect(() => assert1('1')).toThrow();
  });

  test('assertNan verifies NaN values', () => {
    expect(() => assertNan(Number.NaN)).not.toThrow();
    expect(() => assertNan(0)).toThrow();
    expect(() => assertNan('NaN')).toThrow();
  });

  test('assertNegative1 verifies -1 values', () => {
    expect(() => assertNegative1(-1)).not.toThrow();
    expect(() => assertNegative1(0)).toThrow();
    expect(() => assertNegative1('-1')).toThrow();
  });
});

describe('asynchronous assertions', () => {
  test('assertAsync compares values correctly', async () => {
    expect(assertAsync(42, 42)).resolves.toBeUndefined();
    expect(assertAsync('test', 'test')).resolves.toBeUndefined();

    expect(assertAsync(42, 43)).rejects.toThrow();
    expect(assertAsync('test', 'other')).rejects.toThrow();
  });

  test('assertTrueAsync verifies true values', async () => {
    expect(assertTrueAsync(true)).resolves.toBeUndefined();
    expect(assertTrueAsync(Promise.resolve(true))).resolves.toBeUndefined();

    expect(assertTrueAsync(false)).rejects.toThrow();
    expect(assertTrueAsync(Promise.resolve(false))).rejects.toThrow();
  });

  test('assertFalseAsync verifies false values', async () => {
    expect(assertFalseAsync(false)).resolves.toBeUndefined();
    expect(assertFalseAsync(Promise.resolve(false))).resolves.toBeUndefined();

    expect(assertFalseAsync(true)).rejects.toThrow();
    expect(assertFalseAsync(Promise.resolve(true))).rejects.toThrow();
  });

  test('assertUndefinedAsync verifies undefined values', async () => {
    expect(assertUndefinedAsync(undefined)).resolves.toBeUndefined();
    expect(assertUndefinedAsync(null)).rejects.toThrow();
  });

  test('assertNullAsync verifies null values', async () => {
    expect(assertNullAsync(null)).resolves.toBeUndefined();
    expect(assertNullAsync(undefined)).rejects.toThrow();
  });

  test('assertEmptyArrayAsync verifies empty arrays', async () => {
    expect(assertEmptyArrayAsync([])).resolves.toBeUndefined();
    expect(assertEmptyArrayAsync([1])).rejects.toThrow();
  });

  test('assertEmptyObjectAsync verifies empty objects', async () => {
    expect(assertEmptyObjectAsync({})).resolves.toBeUndefined();
    expect(assertEmptyObjectAsync({ a: 1 })).rejects.toThrow();
  });

  test('assert0Async verifies zero values', async () => {
    expect(assert0Async(0)).resolves.toBeUndefined();
    expect(assert0Async(Promise.resolve(0))).resolves.toBeUndefined();

    expect(assert0Async(1)).rejects.toThrow();
  });

  test('assert1Async verifies one values', async () => {
    expect(assert1Async(1)).resolves.toBeUndefined();
    expect(assert1Async(Promise.resolve(1))).resolves.toBeUndefined();

    expect(assert1Async(0)).rejects.toThrow();
  });

  test('assertNanAsync verifies NaN values', async () => {
    expect(assertNanAsync(Number.NaN)).resolves.toBeUndefined();
    expect(assertNanAsync(0)).rejects.toThrow();
  });

  test('assertNegative1Async verifies -1 values', async () => {
    expect(assertNegative1Async(-1)).resolves.toBeUndefined();
    expect(assertNegative1Async(Promise.resolve(-1))).resolves.toBeUndefined();

    expect(assertNegative1Async(0)).rejects.toThrow();
  });
});
