import {
  isArrayEmpty,
  isEmptyArray,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isEmptyArray, () => {
  test('identifies empty arrays correctly', () => {
    expect(isEmptyArray([])).toBe(true);
  });

  test('rejects non-empty arrays and other values', () => {
    expect(isEmptyArray([1])).toBe(false);
    expect(isEmptyArray([null])).toBe(false);
    expect(isEmptyArray([undefined])).toBe(false);
    expect(isEmptyArray(Array.from({ length: 1 }).fill(0))).toBe(false);
    expect(isEmptyArray({})).toBe(false);
    expect(isEmptyArray(null)).toBe(false);
    expect(isEmptyArray(undefined)).toBe(false);
    expect(isEmptyArray('string')).toBe(false);
  });
});

describe(isArrayEmpty, () => {
  test('identifies empty arrays correctly', () => {
    expect(isArrayEmpty([])).toBe(true);
  });

  test('rejects non-empty arrays', () => {
    expect(isArrayEmpty([1])).toBe(false);
    expect(isArrayEmpty([null])).toBe(false);
    expect(isArrayEmpty([undefined])).toBe(false);
    expect(isArrayEmpty(Array.from({ length: 1 }).fill(0))).toBe(false);
  });
});