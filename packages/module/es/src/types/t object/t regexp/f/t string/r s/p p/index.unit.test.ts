import {
  // FIXME: import
  $,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe('string to regex conversion', () => {
  test('converts simple string to regex', () => {
    const result = $('hello',);
    expect(result,).toBeInstanceOf(RegExp,);
    expect(result.test('hello',),).toBe(true,);
    expect(result.test('hello world',),).toBe(false,);
  });

  test('escapes period character', () => {
    const result = $('I love you.',);
    expect(result.test('I love you.',),).toBe(true,);
    expect(result.test('I love youX',),).toBe(false,);
    expect(result.source,).toBe('I love you\\.',);
  });

  test('escapes asterisk character', () => {
    const result = $('Hello*',);
    expect(result.test('Hello*',),).toBe(true,);
    expect(result.test('Hellooo',),).toBe(false,);
    expect(result.source,).toBe('Hello\\*',);
  });

  test('escapes plus character', () => {
    const result = $('test+',);
    expect(result.test('test+',),).toBe(true,);
    expect(result.test('testtt',),).toBe(false,);
    expect(result.source,).toBe('test\\+',);
  });

  test('escapes question mark character', () => {
    const result = $('what?',);
    expect(result.test('what?',),).toBe(true,);
    expect(result.test('wha',),).toBe(false,);
    expect(result.source,).toBe('what\\?',);
  });

  test('escapes caret character', () => {
    const result = $('^start',);
    expect(result.test('^start',),).toBe(true,);
    expect(result.test('start',),).toBe(false,);
    expect(result.source,).toBe('\\^start',);
  });

  test('escapes dollar character', () => {
    const result = $('end$',);
    expect(result.test('end$',),).toBe(true,);
    expect(result.test('end',),).toBe(false,);
    expect(result.source,).toBe('end\\$',);
  });

  test('escapes curly braces', () => {
    const result = $('{count}',);
    expect(result.test('{count}',),).toBe(true,);
    expect(result.source,).toBe('\\{count\\}',);
  });

  test('escapes square brackets', () => {
    const result = $('[array]',);
    expect(result.test('[array]',),).toBe(true,);
    expect(result.source,).toBe('\\[array\\]',);
  });

  test('escapes parentheses', () => {
    const result = $('(group)',);
    expect(result.test('(group)',),).toBe(true,);
    expect(result.source,).toBe('\\(group\\)',);
  });

  test('escapes pipe character', () => {
    const result = $('this|that',);
    expect(result.test('this|that',),).toBe(true,);
    expect(result.test('this',),).toBe(false,);
    expect(result.source,).toBe('this\\|that',);
  });

  test('escapes backslash character', () => {
    const result = $('path\\to',);
    expect(result.test('path\\to',),).toBe(true,);
    expect(result.source,).toBe('path\\\\to',);
  });

  test('escapes forward slash character', () => {
    const result = $('path/to/file',);
    expect(result.test('path/to/file',),).toBe(true,);
    expect(result.source,).toBe('path\\/to\\/file',);
  });

  test('escapes multiple special characters', () => {
    const result = $('Hello.*',);
    expect(result.test('Hello.*',),).toBe(true,);
    expect(result.test('Hellooo',),).toBe(false,);
    expect(result.source,).toBe('Hello\\.\\*',);
  });

  test('handles empty string', () => {
    const result = $('',);
    expect(result.test('',),).toBe(true,);
    expect(result.test('anything',),).toBe(false,);
    expect(result.source,).toBe('',);
  });

  test('handles string with no special characters', () => {
    const result = $('simple text',);
    expect(result.test('simple text',),).toBe(true,);
    expect(result.test('simple',),).toBe(false,);
    expect(result.source,).toBe('simple text',);
  });

  test('handles complex pattern with multiple escapes', () => {
    const result = $('regex: ^[a-z]+$',);
    expect(result.test('regex: ^[a-z]+$',),).toBe(true,);
    expect(result.test('regex: abc',),).toBe(false,);
    expect(result.source,).toBe('regex: \\^\\[a-z\\]\\+\\$',);
  });

  test('handles unicode characters', () => {
    const result = $('Hello 世界',);
    expect(result.test('Hello 世界',),).toBe(true,);
    expect(result.test('Hello',),).toBe(false,);
  });

  test('handles newlines and special whitespace', () => {
    const result = $('line1\nline2',);
    expect(result.test('line1\nline2',),).toBe(true,);
    expect(result.test('line1 line2',),).toBe(false,);
  });

  test('handles tab characters', () => {
    const result = $('col1\tcol2',);
    expect(result.test('col1\tcol2',),).toBe(true,);
    expect(result.test('col1 col2',),).toBe(false,);
  });

  test('real-world example: file path', () => {
    const result = $('/usr/local/bin/script.sh',);
    expect(result.test('/usr/local/bin/script.sh',),).toBe(true,);
    expect(result.source,).toBe('\\/usr\\/local\\/bin\\/script\\.sh',);
  });

  test('real-world example: email with special chars', () => {
    const result = $('user.name+tag@example.com',);
    expect(result.test('user.name+tag@example.com',),).toBe(true,);
    expect(result.source,).toBe('user\\.name\\+tag@example\\.com',);
  });

  test('real-world example: URL', () => {
    const result = $('https://example.com/path?query=value',);
    expect(result.test('https://example.com/path?query=value',),).toBe(true,);
    expect(result.source,).toBe('https:\\/\\/example\\.com\\/path\\?query=value',);
  });

  test('real-world example: regex pattern as string', () => {
    const result = $('^[A-Z]{3}-\\d{4}$',);
    expect(result.test('^[A-Z]{3}-\\d{4}$',),).toBe(true,);
    expect(result.source,).toBe('\\^\\[A-Z\\]\\{3\\}-\\\\d\\{4\\}\\$',);
  });

  test('function returns RegExp instance', () => {
    const result = $('test',);
    expect(result,).toBeInstanceOf(RegExp,);
    expect(typeof result.test,).toBe('function',);
    expect(typeof result.exec,).toBe('function',);
  });

  test('escaped pattern matches only exact string', () => {
    const result = $('special.chars*',);

    // Should match the exact string
    expect(result.test('special.chars*',),).toBe(true,);

    // Should not match variations that would match unescaped regex
    expect(result.test('specialXcharsY',),).toBe(false,);
    expect(result.test('specialchars',),).toBe(false,);
    expect(result.test('special.chars',),).toBe(false,);
    expect(result.test('special.chars**',),).toBe(false,);
  });
});
