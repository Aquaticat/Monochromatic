import {
  isArrayOfLength1,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isArrayOfLength1, () => {
  test('identifies arrays with exactly one element', () => {
    expect(isArrayOfLength1([1])).toBe(true);
    expect(isArrayOfLength1(['string'])).toBe(true);
    expect(isArrayOfLength1([null])).toBe(true);
    expect(isArrayOfLength1([undefined])).toBe(true);
    expect(isArrayOfLength1([{}])).toBe(true);
    expect(isArrayOfLength1([[]])).toBe(true);
  });

  test('rejects arrays with zero elements', () => {
    expect(isArrayOfLength1([])).toBe(false);
  });

  test('rejects arrays with more than one element', () => {
    expect(isArrayOfLength1([1, 2])).toBe(false);
    expect(isArrayOfLength1([1, 2, 3])).toBe(false);
    expect(isArrayOfLength1(['a', 'b', 'c', 'd', 'e'])).toBe(false);
  });

  test('rejects non-arrays', () => {
    expect(isArrayOfLength1(null)).toBe(false);
    expect(isArrayOfLength1(undefined)).toBe(false);
    expect(isArrayOfLength1({})).toBe(false);
    expect(isArrayOfLength1('string')).toBe(false);
    expect(isArrayOfLength1(1)).toBe(false);
    expect(isArrayOfLength1(new Set([1]))).toBe(false);
    expect(isArrayOfLength1(new Map([['key', 'value']]))).toBe(false);
  });
});