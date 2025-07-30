import {
  capitalizeString,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(capitalizeString, () => {
  test('capitalizes first letter of simple strings', () => {
    expect(capitalizeString('hello',),).toBe('Hello',);
    expect(capitalizeString('world',),).toBe('World',);
    expect(capitalizeString('test',),).toBe('Test',);
  });

  test('returns empty string unchanged', () => {
    expect(capitalizeString('',),).toBe('',);
  });

  test('returns already capitalized strings unchanged', () => {
    expect(capitalizeString('Hello',),).toBe('Hello',);
    expect(capitalizeString('Test',),).toBe('Test',);
  });

  test('handles single character strings', () => {
    expect(capitalizeString('a',),).toBe('A',);
    expect(capitalizeString('z',),).toBe('Z',);
    expect(capitalizeString('A',),).toBe('A',);
  });

  test('handles strings with numbers and special characters', () => {
    expect(capitalizeString('123abc',),).toBe('123abc',);
    expect(capitalizeString('_test',),).toBe('_test',);
    expect(capitalizeString('@example',),).toBe('@example',);
  });

  test('works with different locales', () => {
    expect(capitalizeString('istanbul', 'tr-TR',),).toBe('İstanbul',);
    expect(capitalizeString('istanbul', 'en-US',),).toBe('Istanbul',);
    expect(capitalizeString('ñandu', 'es-ES',),).toBe('Ñandu',);
  });

  test('handles unicode characters correctly', () => {
    expect(capitalizeString('über',),).toBe('Über',);
    expect(capitalizeString('électricité',),).toBe('Électricité',);
    expect(capitalizeString('café',),).toBe('Café',);
  });

  test('preserves character case of non-first characters', () => {
    expect(capitalizeString('camelCase',),).toBe('CamelCase',);
    expect(capitalizeString('mixedCASE',),).toBe('MixedCASE',);
  });

  test('handles string with spaces', () => {
    expect(capitalizeString('hello world',),).toBe('Hello world',);
    expect(capitalizeString(' leading space',),).toBe(' leading space',);
  });
},);
