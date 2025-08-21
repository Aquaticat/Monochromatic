import {
  isDigitString,
  isDigitsString,
  isNo0DigitString,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isDigitString, () => {
  test('identifies single digit strings correctly', () => {
    expect(isDigitString('0')).toBe(true);
    expect(isDigitString('1')).toBe(true);
    expect(isDigitString('2')).toBe(true);
    expect(isDigitString('3')).toBe(true);
    expect(isDigitString('4')).toBe(true);
    expect(isDigitString('5')).toBe(true);
    expect(isDigitString('6')).toBe(true);
    expect(isDigitString('7')).toBe(true);
    expect(isDigitString('8')).toBe(true);
    expect(isDigitString('9')).toBe(true);
  });

  test('rejects multi-digit strings', () => {
    expect(isDigitString('10')).toBe(false);
    expect(isDigitString('123')).toBe(false);
    expect(isDigitString('00')).toBe(false);
  });

  test('rejects non-digit strings', () => {
    expect(isDigitString('a')).toBe(false);
    expect(isDigitString('A')).toBe(false);
    expect(isDigitString('-')).toBe(false);
    expect(isDigitString('+')).toBe(false);
    expect(isDigitString(' ')).toBe(false);
    expect(isDigitString('')).toBe(false);
    expect(isDigitString('.')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isDigitString(5)).toBe(false);
    expect(isDigitString(0)).toBe(false);
    expect(isDigitString(true)).toBe(false);
    expect(isDigitString(null)).toBe(false);
    expect(isDigitString(undefined)).toBe(false);
    expect(isDigitString([])).toBe(false);
    expect(isDigitString({})).toBe(false);
  });
});

describe(isNo0DigitString, () => {
  test('identifies non-zero single digit strings correctly', () => {
    expect(isNo0DigitString('1')).toBe(true);
    expect(isNo0DigitString('2')).toBe(true);
    expect(isNo0DigitString('3')).toBe(true);
    expect(isNo0DigitString('4')).toBe(true);
    expect(isNo0DigitString('5')).toBe(true);
    expect(isNo0DigitString('6')).toBe(true);
    expect(isNo0DigitString('7')).toBe(true);
    expect(isNo0DigitString('8')).toBe(true);
    expect(isNo0DigitString('9')).toBe(true);
  });

  test('rejects zero', () => {
    expect(isNo0DigitString('0')).toBe(false);
  });

  test('rejects multi-digit strings', () => {
    expect(isNo0DigitString('10')).toBe(false);
    expect(isNo0DigitString('123')).toBe(false);
    expect(isNo0DigitString('11')).toBe(false);
  });

  test('rejects non-digit strings', () => {
    expect(isNo0DigitString('a')).toBe(false);
    expect(isNo0DigitString('A')).toBe(false);
    expect(isNo0DigitString('-')).toBe(false);
    expect(isNo0DigitString('+')).toBe(false);
    expect(isNo0DigitString(' ')).toBe(false);
    expect(isNo0DigitString('')).toBe(false);
    expect(isNo0DigitString('.')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isNo0DigitString(5)).toBe(false);
    expect(isNo0DigitString(1)).toBe(false);
    expect(isNo0DigitString(true)).toBe(false);
    expect(isNo0DigitString(null)).toBe(false);
    expect(isNo0DigitString(undefined)).toBe(false);
    expect(isNo0DigitString([])).toBe(false);
    expect(isNo0DigitString({})).toBe(false);
  });
});

describe(isDigitsString, () => {
  test('identifies strings containing only digits', () => {
    expect(isDigitsString('0')).toBe(true);
    expect(isDigitsString('1')).toBe(true);
    expect(isDigitsString('9')).toBe(true);
    expect(isDigitsString('10')).toBe(true);
    expect(isDigitsString('123')).toBe(true);
    expect(isDigitsString('000')).toBe(true);
    expect(isDigitsString('1234567890')).toBe(true);
    expect(isDigitsString('0123456789')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isDigitsString('')).toBe(false);
  });

  test('rejects strings with non-digit characters', () => {
    expect(isDigitsString('1a2')).toBe(false);
    expect(isDigitsString('12.3')).toBe(false);
    expect(isDigitsString('12-3')).toBe(false);
    expect(isDigitsString('+123')).toBe(false);
    expect(isDigitsString('-123')).toBe(false);
    expect(isDigitsString('12 3')).toBe(false);
    expect(isDigitsString('123\n')).toBe(false);
    expect(isDigitsString('\t123')).toBe(false);
  });

  test('rejects strings with letters', () => {
    expect(isDigitsString('abc')).toBe(false);
    expect(isDigitsString('ABC')).toBe(false);
    expect(isDigitsString('1a')).toBe(false);
    expect(isDigitsString('a1')).toBe(false);
    expect(isDigitsString('1A')).toBe(false);
    expect(isDigitsString('A1')).toBe(false);
  });

  test('rejects strings with special characters', () => {
    expect(isDigitsString('!@#')).toBe(false);
    expect(isDigitsString('123!')).toBe(false);
    expect(isDigitsString('!123')).toBe(false);
    expect(isDigitsString('1!2')).toBe(false);
    expect(isDigitsString('.')).toBe(false);
    expect(isDigitsString(',')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isDigitsString(123)).toBe(false);
    expect(isDigitsString(0)).toBe(false);
    expect(isDigitsString(true)).toBe(false);
    expect(isDigitsString(false)).toBe(false);
    expect(isDigitsString(null)).toBe(false);
    expect(isDigitsString(undefined)).toBe(false);
    expect(isDigitsString([])).toBe(false);
    expect(isDigitsString({})).toBe(false);
    expect(isDigitsString(new Date())).toBe(false);
  });
});