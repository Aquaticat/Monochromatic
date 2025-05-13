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
  trimEndWith,
  trimStartWith,
} from './string.trim.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('trimStartWith', () => {
  test('removes trimmer from start of string', () => {
    expect(trimStartWith('prefixString', 'prefix')).toBe('String');
  });

  test('removes multiple occurrences of trimmer from start', () => {
    expect(trimStartWith('prefixprefixText', 'prefix')).toBe('Text');
    expect(trimStartWith('aaaaabc', 'a')).toBe('bc');
  });

  test('returns original string if trimmer not found at start', () => {
    expect(trimStartWith('String', 'suffix')).toBe('String');
  });

  test('handles empty string input', () => {
    expect(trimStartWith('', 'prefix')).toBe('');
  });

  test('handles empty trimmer', () => {
    expect(() => {
      trimStartWith('String', '');
    })
      .toThrow();
  });

  test('handles case sensitivity correctly', () => {
    expect(trimStartWith('PrefixString', 'prefix')).toBe('PrefixString');
    expect(trimStartWith('PREFIXString', 'PREFIX')).toBe('String');
  });
});

describe('trimEndWith', () => {
  test('removes trimmer from end of string', () => {
    expect(trimEndWith('StringSuffix', 'Suffix')).toBe('String');
  });

  test('removes multiple occurrences of trimmer from end', () => {
    expect(trimEndWith('TextSuffixSuffix', 'Suffix')).toBe('Text');
    expect(trimEndWith('abcaaa', 'a')).toBe('abc');
  });

  test('returns original string if trimmer not found at end', () => {
    expect(trimEndWith('String', 'prefix')).toBe('String');
  });

  test('handles empty string input', () => {
    expect(trimEndWith('', 'suffix')).toBe('');
  });

  test('handles empty trimmer', () => {
    expect(() => {
      trimEndWith('String', '');
    })
      .toThrow();
  });

  test('handles case sensitivity correctly', () => {
    expect(trimEndWith('StringSuffix', 'suffix')).toBe('StringSuffix');
    expect(trimEndWith('StringSUFFIX', 'SUFFIX')).toBe('String');
  });

  test('handles complex string operations correctly', () => {
    expect(trimEndWith('ab-ab-ab-', 'ab-')).toBe('');
    expect(trimEndWith('-ab-ab-ab', 'ab')).toBe('-ab-ab-');
  });
});
