import {
  capitalize,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('capitalize', () => {
  test('capitalizes first letter of simple strings', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('world')).toBe('World');
    expect(capitalize('test')).toBe('Test');
  });

  test('returns empty string unchanged', () => {
    expect(capitalize('')).toBe('');
  });

  test('returns already capitalized strings unchanged', () => {
    expect(capitalize('Hello')).toBe('Hello');
    expect(capitalize('Test')).toBe('Test');
  });

  test('handles single character strings', () => {
    expect(capitalize('a')).toBe('A');
    expect(capitalize('z')).toBe('Z');
    expect(capitalize('A')).toBe('A');
  });

  test('handles strings with numbers and special characters', () => {
    expect(capitalize('123abc')).toBe('123abc');
    expect(capitalize('_test')).toBe('_test');
    expect(capitalize('@example')).toBe('@example');
  });

  test('works with different locales', () => {
    expect(capitalize('istanbul', 'tr-TR')).toBe('İstanbul');
    expect(capitalize('istanbul', 'en-US')).toBe('Istanbul');
    expect(capitalize('ñandu', 'es-ES')).toBe('Ñandu');
  });

  test('handles unicode characters correctly', () => {
    expect(capitalize('über')).toBe('Über');
    expect(capitalize('électricité')).toBe('Électricité');
    expect(capitalize('café')).toBe('Café');
  });

  test('preserves character case of non-first characters', () => {
    expect(capitalize('camelCase')).toBe('CamelCase');
    expect(capitalize('mixedCASE')).toBe('MixedCASE');
  });

  test('handles string with spaces', () => {
    expect(capitalize('hello world')).toBe('Hello world');
    expect(capitalize(' leading space')).toBe(' leading space');
  });
});
