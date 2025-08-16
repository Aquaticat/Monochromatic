import {
  logtapeConfiguration,
  logtapeConfigure,
  trimEndWith,
  trimStartWith,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('trimEndWith', () => {
  test('should remove single occurrence of trimmer from end', () => {
    expect(trimEndWith('StringSuffix', 'Suffix')).toBe('String');
    expect(trimEndWith('Hello World!', '!')).toBe('Hello World');
    expect(trimEndWith('test.txt', '.txt')).toBe('test');
  });

  test('should remove multiple consecutive occurrences from end', () => {
    expect(trimEndWith('TextSuffixSuffix', 'Suffix')).toBe('Text');
    expect(trimEndWith('abcaaa', 'a')).toBe('abc');
    expect(trimEndWith('HelloHelloHello', 'Hello')).toBe('');
    expect(trimEndWith('...', '.')).toBe('');
  });

  test('should return unchanged string when trimmer not at end', () => {
    expect(trimEndWith('String', 'prefix')).toBe('String');
    expect(trimEndWith('Hello World', 'Hello')).toBe('Hello World');
    expect(trimEndWith('test.txt.backup', '.txt')).toBe('test.txt.backup');
  });

  test('should handle empty input string', () => {
    expect(trimEndWith('', 'suffix')).toBe('');
  });

  test('should handle case when trimmer equals entire string', () => {
    expect(trimEndWith('test', 'test')).toBe('');
    expect(trimEndWith('aaa', 'a')).toBe('');
  });

  test('should handle case when trimmer longer than string', () => {
    expect(trimEndWith('hi', 'hello')).toBe('hi');
  });

  test('should be case sensitive', () => {
    expect(trimEndWith('StringSUFFIX', 'suffix')).toBe('StringSUFFIX');
    expect(trimEndWith('StringSuffix', 'SUFFIX')).toBe('StringSuffix');
  });

  test('should handle special characters', () => {
    expect(trimEndWith('Hello[end]', '[end]')).toBe('Hello');
    expect(trimEndWith('test***', '*')).toBe('test');
    expect(trimEndWith('data\\n\\n', '\\n')).toBe('data');
  });

  test('should throw error when trimmer is empty string', () => {
    expect(() => trimEndWith('test', '')).toThrow('trimmer cannot be empty');
  });

  test('should handle Unicode characters', () => {
    expect(trimEndWith('Hello世界', '世界')).toBe('Hello');
    expect(trimEndWith('test🚀🚀', '🚀')).toBe('test');
  });
});

describe('trimStartWith', () => {
  test('should remove single occurrence of trimmer from start', () => {
    expect(trimStartWith('prefixString', 'prefix')).toBe('String');
    expect(trimStartWith('!Hello World', '!')).toBe('Hello World');
    expect(trimStartWith('Mr. Smith', 'Mr. ')).toBe('Smith');
  });

  test('should remove multiple consecutive occurrences from start', () => {
    expect(trimStartWith('prefixprefixText', 'prefix')).toBe('Text');
    expect(trimStartWith('aaaaabc', 'a')).toBe('bc');
    expect(trimStartWith('HelloHelloWorld', 'Hello')).toBe('World');
    expect(trimStartWith('...', '.')).toBe('');
  });

  test('should return unchanged string when trimmer not at start', () => {
    expect(trimStartWith('String', 'suffix')).toBe('String');
    expect(trimStartWith('Hello World', 'World')).toBe('Hello World');
    expect(trimStartWith('backup.test.txt', '.txt')).toBe('backup.test.txt');
  });

  test('should handle empty input string', () => {
    expect(trimStartWith('', 'prefix')).toBe('');
  });

  test('should handle case when trimmer equals entire string', () => {
    expect(trimStartWith('test', 'test')).toBe('');
    expect(trimStartWith('aaa', 'a')).toBe('');
  });

  test('should handle case when trimmer longer than string', () => {
    expect(trimStartWith('hi', 'hello')).toBe('hi');
  });

  test('should be case sensitive', () => {
    expect(trimStartWith('PREFIXString', 'prefix')).toBe('PREFIXString');
    expect(trimStartWith('prefixString', 'PREFIX')).toBe('prefixString');
  });

  test('should handle special characters', () => {
    expect(trimStartWith('[start]Hello', '[start]')).toBe('Hello');
    expect(trimStartWith('***test', '*')).toBe('test');
    expect(trimStartWith('\\n\\ndata', '\\n')).toBe('data');
  });

  test('should throw error when trimmer is empty string', () => {
    expect(() => trimStartWith('test', '')).toThrow('trimmer cannot be empty');
  });

  test('should handle Unicode characters', () => {
    expect(trimStartWith('世界Hello', '世界')).toBe('Hello');
    expect(trimStartWith('🚀🚀test', '🚀')).toBe('test');
  });

  test('should handle trimmer that appears multiple times but not consecutively', () => {
    expect(trimStartWith('abcabcdef', 'abc')).toBe('def');
    expect(trimStartWith('testTEST', 'test')).toBe('TEST');
  });
});

describe('trimStartWith and trimEndWith integration', () => {
  test('should work together to trim from both ends', () => {
    let result = 'prefixContentSuffix';
    result = trimStartWith(result, 'prefix');
    result = trimEndWith(result, 'Suffix');
    expect(result).toBe('Content');
  });

  test('should handle overlapping trimmers', () => {
    expect(trimStartWith('abcabc', 'abc')).toBe('');
    expect(trimEndWith('abcabc', 'abc')).toBe('');
  });
});