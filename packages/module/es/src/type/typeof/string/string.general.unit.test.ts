import {
  isObjectRegexp,
  isString,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isString, () => {
  test('identifies strings correctly', () => {
    expect(isString('')).toBe(true);
    expect(isString('hello')).toBe(true);
    expect(isString('123')).toBe(true);
    expect(isString(' ')).toBe(true);
    expect(isString('\n')).toBe(true);
    expect(isString('🚀')).toBe(true);
  });

  test('rejects non-strings', () => {
    expect(isString(123)).toBe(false);
    expect(isString(true)).toBe(false);
    expect(isString(false)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString([])).toBe(false);
    expect(isString({})).toBe(false);
    expect(isString(new Date())).toBe(false);
    expect(isString(/regex/)).toBe(false);
  });

  test('rejects string objects', () => {
    // eslint-disable-next-line no-new-wrappers -- Testing string objects
    expect(isString(new String('test'))).toBe(false);
  });
});

describe(isObjectRegexp, () => {
  test('identifies RegExp objects correctly', () => {
    expect(isObjectRegexp(/test/)).toBe(true);
    expect(isObjectRegexp(/^[a-z]+$/i)).toBe(true);
    expect(isObjectRegexp(new RegExp('test'))).toBe(true);
    expect(isObjectRegexp(new RegExp('[0-9]+', 'g'))).toBe(true);
    expect(isObjectRegexp(/\d{3}-\d{3}-\d{4}/)).toBe(true);
  });

  test('rejects non-RegExp values', () => {
    expect(isObjectRegexp('test')).toBe(false);
    expect(isObjectRegexp('/test/')).toBe(false);
    expect(isObjectRegexp(123)).toBe(false);
    expect(isObjectRegexp(true)).toBe(false);
    expect(isObjectRegexp(null)).toBe(false);
    expect(isObjectRegexp(undefined)).toBe(false);
    expect(isObjectRegexp([])).toBe(false);
    expect(isObjectRegexp({})).toBe(false);
    expect(isObjectRegexp(new Date())).toBe(false);
  });

  test('rejects regexp-like objects', () => {
    const fakeRegex = {
      test: () => true,
      exec: () => null,
      source: 'test',
      flags: 'g',
    };
    expect(isObjectRegexp(fakeRegex)).toBe(false);
  });
});