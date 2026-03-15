import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const { $, } = types.string.from.string.trim.with.string.sync.named;

describe('trim with string - synchronous named', () => {
  test('trims single character from both ends', () => {
    expect($({ str: 'abc', trimmer: 'a', },),).toBe('bc',);
  });

  test('trims multi-character string from both ends', () => {
    expect($({ str: 'TextSuffixText', trimmer: 'Text', },),).toBe('Suffix',);
  });

  test('trims only from start when pattern exists only at start', () => {
    expect($({ str: 'PrefixString', trimmer: 'Prefix', },),).toBe('String',);
  });

  test('trims only from end when pattern exists only at end', () => {
    expect($({ str: 'StringSuffix', trimmer: 'Suffix', },),).toBe('String',);
  });

  test('trims from both ends when pattern exists on both sides', () => {
    expect($({ str: 'PrefixStringSuffix', trimmer: 'Prefix', },),).toBe('StringSuffix',);
  });

  test('removes multiple consecutive occurrences from start', () => {
    expect($({ str: 'xxxText', trimmer: 'x', },),).toBe('Text',);
  });

  test('removes multiple consecutive occurrences from end', () => {
    expect($({ str: 'Textxxx', trimmer: 'x', },),).toBe('Text',);
  });

  test('removes multiple consecutive occurrences from both ends', () => {
    expect($({ str: 'xxxTextxxx', trimmer: 'x', },),).toBe('Text',);
  });

  test('removes different amounts from both ends', () => {
    expect($({ str: 'xxTextxxx', trimmer: 'x', },),).toBe('Text',);
  });

  test('removes repeated multi-character patterns', () => {
    expect($({ str: 'file.txt.txt.txt', trimmer: '.txt', },),).toBe('file',);
  });

  test('case sensitive matching - different trimmer does not match', () => {
    expect($({ str: 'StringSUFFIX', trimmer: 'suffix', },),).toBe('StringSUFFIX',);
  });

  test('case sensitive matching - correct case is trimmed', () => {
    expect($({ str: 'StringSUFFIX', trimmer: 'SUFFIX', },),).toBe('String',);
  });

  test('handles empty string input', () => {
    expect($({ str: '', trimmer: 'anything', },),).toBe('',);
  });

  test('returns unchanged when trimmer not found', () => {
    expect($({ str: 'String', trimmer: 'prefix', },),).toBe('String',);
  });

  test('returns unchanged when trimmer is empty string', () => {
    expect($({ str: 'unchanged', trimmer: '', },),).toBe('unchanged',);
  });

  test('handles single character strings', () => {
    expect($({ str: 'a', trimmer: 'a', },),).toBe('',);
  });

  test('trimmer that matches entire string returns empty', () => {
    expect($({ str: 'match', trimmer: 'match', },),).toBe('',);
  });

  test('trimmer longer than input string returns unchanged', () => {
    expect($({ str: 'short', trimmer: 'longer', },),).toBe('short',);
  });

  test('trimmer with special regex characters is escaped', () => {
    expect($({ str: '.txt.file.txt', trimmer: '.txt', },),).toBe('.file',);
  });

  test('trimmer with spaces', () => {
    expect($({ str: '  Text  ', trimmer: ' ', },),).toBe('Text',);
  });

  test('trims pattern from start when it matches', () => {
    expect($({ str: 'abcaaabca', trimmer: 'abc', },),).toBe('aaabca',);
  });

  test('removes repeated file extensions from end only when start has different prefix', () => {
    expect($({ str: '.backup.document.backup', trimmer: '.backup', },),).toBe(
      '.document',
    );
  });

  test('removes trailing slashes from URLs', () => {
    expect($({ str: 'https://example.com/', trimmer: '/', },),).toBe(
      'https://example.com',
    );
  });

  test('removes multiple trailing slashes from URLs', () => {
    expect($({ str: 'path/to/directory///', trimmer: '/', },),).toBe(
      'path/to/directory',
    );
  });

  test('removes repeated suffixes', () => {
    expect($({ str: 'testTestTest', trimmer: 'Test', },),).toBe('test',);
  });

  test('handles unicode characters', () => {
    expect($({ str: '世界Text世界', trimmer: '世界', },),).toBe('Text',);
  });

  test('handles characters with special regex meaning', () => {
    expect($({ str: '.file.', trimmer: '.', },),).toBe('file',);
  });

  test('handles dollar signs', () => {
    expect($({ str: '$$price$$', trimmer: '$', },),).toBe('price',);
  });

  test('handles question marks', () => {
    expect($({ str: '??test???', trimmer: '?', },),).toBe('test',);
  });

  test('handles asterisks', () => {
    expect($({ str: '***text***', trimmer: '*', },),).toBe('text',);
  });

  test('handles plus signs', () => {
    expect($({ str: '+++value+++', trimmer: '+', },),).toBe('value',);
  });

  test('handles pipe characters', () => {
    expect($({ str: '|data|', trimmer: '|', },),).toBe('data',);
  });

  test('handles backslash characters', () => {
    expect($({ str: '\\path\\', trimmer: '\\', },),).toBe('path',);
  });

  test('handles caret characters', () => {
    expect($({ str: '^content^', trimmer: '^', },),).toBe('content',);
  });

  test('handles square brackets', () => {
    expect($({ str: '[]value[]', trimmer: '[]', },),).toBe('value',);
  });

  test('handles curly braces', () => {
    expect($({ str: '{}data{}', trimmer: '{}', },),).toBe('data',);
  });

  test('handles parentheses', () => {
    expect($({ str: '(text)', trimmer: '(', },),).toBe('text)',);
  });

  test('trims newline characters', () => {
    expect($({ str: '\nText\n', trimmer: '\n', },),).toBe('Text',);
  });

  test('trims tab characters', () => {
    expect($({ str: '\tText\t', trimmer: '\t', },),).toBe('Text',);
  });

  test('trims carriage return characters', () => {
    expect($({ str: '\rContent\r', trimmer: '\r', },),).toBe('Content',);
  });

  test('handles emoji characters', () => {
    expect($({ str: '🚀test🚀', trimmer: '🚀', },),).toBe('test',);
  });

  test('handles mixed whitespace and text', () => {
    expect($({ str: '   Hello   ', trimmer: ' ', },),).toBe('Hello',);
  });

  test('removes hyphen patterns from both ends', () => {
    expect($({ str: '--text--', trimmer: '-', },),).toBe('text',);
  });

  test('removes underscore patterns from both ends', () => {
    expect($({ str: '__value__', trimmer: '_', },),).toBe('value',);
  });

  test('handles identical trimmer and input text pattern', () => {
    expect($({ str: 'aaa', trimmer: 'a', },),).toBe('',);
  });

  test('handles trimmer that appears only in middle', () => {
    expect($({ str: 'abcaaa', trimmer: 'abc', },),).toBe('aaa',);
  });

  test('handles mixed case trimmer with exact match', () => {
    expect($({ str: 'PREFIXStringPREFIX', trimmer: 'PREFIX', },),).toBe('String',);
  });

  test('removes leading and trailing zeros', () => {
    expect($({ str: '000123000', trimmer: '0', },),).toBe('123',);
  });

  test('handles nested patterns', () => {
    expect($({ str: '((text))', trimmer: '((', },),).toBe('text))',);
  });

  test('handles very long strings efficiently', () => {
    const longStr = 'a'.repeat(1_000,) + 'text' + 'a'.repeat(1_000,);
    expect($({ str: longStr, trimmer: 'a', },),).toBe('text',);
  });

  test('trimmer with special regex characters', () => {
    expect($({ str: '.*.', trimmer: '.*', },),).toBe('.',);
  });

  test('handles multiple consecutive multi-char patterns at start only', () => {
    expect($({ str: 'xxxyyyText', trimmer: 'xxx', },),).toBe('yyyText',);
  });

  test('handles multiple consecutive multi-char patterns at end only', () => {
    expect($({ str: 'Textxxxyyy', trimmer: 'yyy', },),).toBe('Textxxx',);
  });
});
