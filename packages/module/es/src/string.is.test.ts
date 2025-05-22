import {
  isNegativeFloatString,
  isNegativeIntString,
  isPositiveFloatString,
  isPositiveIntString,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isPositiveIntString, () => {
  test('valid cases', () => {
    expect(isPositiveIntString('0')).toBe(true);
    expect(isPositiveIntString('1')).toBe(true);
    expect(isPositiveIntString('10')).toBe(true);
    expect(isPositiveIntString('11')).toBe(true);
  });

  test('invalid cases', () => {
    expect(isPositiveIntString('')).toBe(false);
    expect(isPositiveIntString('-0')).toBe(false);
    expect(isPositiveIntString('-1')).toBe(false);
    expect(isPositiveIntString('01')).toBe(false);
    expect(isPositiveIntString('-10')).toBe(false);
    expect(isPositiveIntString('-11')).toBe(false);
  });
});

describe(isNegativeIntString, () => {
  test('valid cases', () => {
    expect(isNegativeIntString('-0')).toBe(true);
    expect(isNegativeIntString('-1')).toBe(true);
    expect(isNegativeIntString('-10')).toBe(true);
    expect(isNegativeIntString('-11')).toBe(true);
  });

  test('invalid cases', () => {
    expect(isNegativeIntString('')).toBe(false);
    expect(isNegativeIntString('0')).toBe(false);
    expect(isNegativeIntString('1')).toBe(false);
    expect(isNegativeIntString('01')).toBe(false);
    expect(isNegativeIntString('10')).toBe(false);
    expect(isNegativeIntString('-01')).toBe(false);
  });
});

describe(isPositiveFloatString, () => {
  test('valid cases', () => {
    expect(isPositiveFloatString('0.1')).toBe(true);
    expect(isPositiveFloatString('0.10')).toBe(true);
    expect(isPositiveFloatString('10.10')).toBe(true);
  });

  test('invalid cases', () => {
    expect(isPositiveFloatString('')).toBe(false);
    expect(isPositiveFloatString('0')).toBe(false);
    expect(isPositiveFloatString('1')).toBe(false);
    expect(isPositiveFloatString('-0')).toBe(false);
    expect(isPositiveFloatString('-1')).toBe(false);
    expect(isPositiveFloatString('0.')).toBe(false);
    expect(isPositiveFloatString('0.0')).toBe(false);
    expect(isPositiveFloatString('1.1.1')).toBe(false);
    expect(isPositiveFloatString('0.00')).toBe(false);
    expect(isPositiveFloatString('00.0')).toBe(false);
    expect(isPositiveFloatString('01.10')).toBe(false);
  });
});

describe(isNegativeFloatString, () => {
  test('valid cases', () => {
    expect(isNegativeFloatString('-0.1')).toBe(true);
    expect(isNegativeFloatString('-0.10')).toBe(true);
    expect(isNegativeFloatString('-10.10')).toBe(true);
    expect(isNegativeFloatString('-1.2')).toBe(true);
  });

  test('invalid cases', () => {
    expect(isNegativeFloatString('')).toBe(false);
    expect(isNegativeFloatString('0')).toBe(false);
    expect(isNegativeFloatString('-0')).toBe(false);
    expect(isNegativeFloatString('-1')).toBe(false);
    expect(isNegativeFloatString('0.1')).toBe(false);
    expect(isNegativeFloatString('-0.')).toBe(false);
    expect(isNegativeFloatString('-0.0')).toBe(false);
    expect(isNegativeFloatString('-0.00')).toBe(false);
    expect(isNegativeFloatString('-00.1')).toBe(false);
    expect(isNegativeFloatString('-01.10')).toBe(false);
    expect(isNegativeFloatString('-1.1.1')).toBe(false);
  });
});
