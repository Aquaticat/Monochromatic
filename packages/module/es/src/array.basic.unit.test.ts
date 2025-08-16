import {
  isArray,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isArray, () => {
  test('identifies arrays correctly', () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray(Array.from({ length: 5 }))).toBe(true);
  });

  test('rejects non-arrays', () => {
    expect(isArray(null)).toBe(false);
    expect(isArray(undefined)).toBe(false);
    expect(isArray({})).toBe(false);
    expect(isArray('array')).toBe(false);
    expect(isArray(new Set([1, 2, 3]))).toBe(false);
    expect(isArray(new Map())).toBe(false);
  });
});