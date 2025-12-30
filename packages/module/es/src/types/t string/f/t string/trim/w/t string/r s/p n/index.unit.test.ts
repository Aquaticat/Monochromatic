import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

const $ = types.string.from.string.trim.with.string.sync.named.$;

describe('trim with string - synchronous named', () => {
  test('trims single character from both ends', ({ expect, },) => {
    expect($({ str: 'abc', trimmer: 'a', },),).toBe('bc',);
  });

  test('trims multi-character string from both ends', ({ expect, },) => {
    expect($({ str: 'TextSuffixText', trimmer: 'Text', },),).toBe('Suffix',);
  });

  test('trims only from start when pattern exists only at start', ({ expect, },) => {
    expect($({ str: 'PrefixString', trimmer: 'Prefix', },),).toBe('String',);
  });

  test('trims only from end when pattern exists only at end', ({ expect, },) => {
    expect($({ str: 'StringSuffix', trimmer: 'Suffix', },),).toBe('String',);
  });

  test('trims from both ends when pattern exists on both sides', ({ expect, },) => {
    expect($({ str: 'PrefixStringSuffix', trimmer: 'Prefix', },),).toBe('StringSuffix',);
  });

  test('removes multiple consecutive occurrences from start', ({ expect, },) => {
    expect($({ str: 'xxxText', trimmer: 'x', },),).toBe('Text',);
  });

  test('removes multiple consecutive occurrences from end', ({ expect, },) => {
    expect($({ str: 'Textxxx', trimmer: 'x', },),).toBe('Text',);
  });

  test('removes multiple consecutive occurrences from both ends', ({ expect, },) => {
    expect($({ str: 'xxxTextxxx', trimmer: 'x', },),).toBe('Text',);
  });

  test('removes different amounts from both ends', ({ expect, },) => {
    expect($({ str: 'xxTextxxx', trimmer: 'x', },),).toBe('Text',);
  });

  test('removes repeated multi-character patterns', ({ expect, },) => {
    expect($({ str: 'file.txt.txt.txt', trimmer: '.txt', },),).toBe('file',);
  });

  test('case sensitive matching - different trimmer does not match', ({ expect, },) => {
    expect($({ str: 'StringSUFFIX', trimmer: 'suffix', },),).toBe('StringSUFFIX',);
  });

  test('case sensitive matching - correct case is trimmed', ({ expect, },) => {
    expect($({ str: 'StringSUFFIX', trimmer: 'SUFFIX', },),).toBe('String',);
  });

  test('handles empty string input', ({ expect, },) => {
    expect($({ str: '', trimmer: 'anything', },),).toBe('',);
  });

  test('returns unchanged when trimmer not found', ({ expect, },) => {
    expect($({ str: 'String', trimmer: 'prefix', },),).toBe('String',);
  });

  test('returns unchanged when trimmer is empty string', ({ expect, },) => {
    expect($({ str: 'unchanged', trimmer: '', },),).toBe('unchanged',);
  });

  test('handles single character strings', ({ expect, },) => {
    expect($({ str: 'a', trimmer: 'a', },),).toBe('',);
  });

  test('trimmer that matches entire string returns empty', ({ expect, },) => {
    expect($({ str: 'match', trimmer: 'match', },),).toBe('',);
  });

  test('trimmer longer than input string returns unchanged', ({ expect, },) => {
    expect($({ str: 'short', trimmer: 'longer', },),).toBe('short',);
  });

  test('trimmer with special regex characters is escaped', ({ expect, },) => {
    expect($({ str: '.txt.file.txt', trimmer: '.txt', },),).toBe('.file',);
  });

  test('trimmer with spaces', ({ expect, },) => {
    expect($({ str: '  Text  ', trimmer: ' ', },),).toBe('Text',);
  });

  test('trims pattern from start when it matches', ({ expect, },) => {
    expect($({ str: 'abcaaabca', trimmer: 'abc', },),).toBe('aaabca',);
  });

  test('removes repeated file extensions from end only when start has different prefix', ({ expect, },) => {
    expect($({ str: '.backup.document.backup', trimmer: '.backup', },),).toBe('.document',);
  });

  test('removes trailing slashes from URLs', ({ expect, },) => {
    expect($({ str: 'https://example.com/', trimmer: '/', },),).toBe('https://example.com',);
  });

  test('removes multiple trailing slashes from URLs', ({ expect, },) => {
    expect($({ str: 'path/to/directory///', trimmer: '/', },),).toBe('path/to/directory',);
  });

  test('removes repeated suffixes', ({ expect, },) => {
    expect($({ str: 'testTestTest', trimmer: 'Test', },),).toBe('test',);
  });

  test('handles unicode characters', ({ expect, },) => {
    expect($({ str: '世界Text世界', trimmer: '世界', },),).toBe('Text',);
  });

  test('handles characters with special regex meaning', ({ expect, },) => {
    expect($({ str: '.file.', trimmer: '.', },),).toBe('file',);
  });

  test('handles dollar signs', ({ expect, },) => {
    expect($({ str: '$$price$$', trimmer: '$', },),).toBe('price',);
  });

  test('handles question marks', ({ expect, },) => {
    expect($({ str: '??test???', trimmer: '?', },),).toBe('test',);
  });

  test('handles asterisks', ({ expect, },) => {
    expect($({ str: '***text***', trimmer: '*', },),).toBe('text',);
  });

  test('handles plus signs', ({ expect, },) => {
    expect($({ str: '+++value+++', trimmer: '+', },),).toBe('value',);
  });

  test('handles pipe characters', ({ expect, },) => {
    expect($({ str: '|data|', trimmer: '|', },),).toBe('data',);
  });

  test('handles backslash characters', ({ expect, },) => {
    expect($({ str: '\\path\\', trimmer: '\\', },),).toBe('path',);
  });

  test('handles caret characters', ({ expect, },) => {
    expect($({ str: '^content^', trimmer: '^', },),).toBe('content',);
  });

  test('handles square brackets', ({ expect, },) => {
    expect($({ str: '[]value[]', trimmer: '[]', },),).toBe('value',);
  });

  test('handles curly braces', ({ expect, },) => {
    expect($({ str: '{}data{}', trimmer: '{}', },),).toBe('data',);
  });

  test('handles parentheses', ({ expect, },) => {
    expect($({ str: '(text)', trimmer: '(', },),).toBe('text)',);
  });

  test('trims newline characters', ({ expect, },) => {
    expect($({ str: '\nText\n', trimmer: '\n', },),).toBe('Text',);
  });

  test('trims tab characters', ({ expect, },) => {
    expect($({ str: '\tText\t', trimmer: '\t', },),).toBe('Text',);
  });

  test('trims carriage return characters', ({ expect, },) => {
    expect($({ str: '\rContent\r', trimmer: '\r', },),).toBe('Content',);
  });

  test('handles emoji characters', ({ expect, },) => {
    expect($({ str: '🚀test🚀', trimmer: '🚀', },),).toBe('test',);
  });

  test('handles mixed whitespace and text', ({ expect, },) => {
    expect($({ str: '   Hello   ', trimmer: ' ', },),).toBe('Hello',);
  });

  test('removes hyphen patterns from both ends', ({ expect, },) => {
    expect($({ str: '--text--', trimmer: '-', },),).toBe('text',);
  });

  test('removes underscore patterns from both ends', ({ expect, },) => {
    expect($({ str: '__value__', trimmer: '_', },),).toBe('value',);
  });

  test('handles identical trimmer and input text pattern', ({ expect, },) => {
    expect($({ str: 'aaa', trimmer: 'a', },),).toBe('',);
  });

  test('handles trimmer that appears only in middle', ({ expect, },) => {
    expect($({ str: 'abcaaa', trimmer: 'abc', },),).toBe('aaa',);
  });

  test('handles mixed case trimmer with exact match', ({ expect, },) => {
    expect($({ str: 'PREFIXStringPREFIX', trimmer: 'PREFIX', },),).toBe('String',);
  });

  test('removes leading and trailing zeros', ({ expect, },) => {
    expect($({ str: '000123000', trimmer: '0', },),).toBe('123',);
  });

  test('handles nested patterns', ({ expect, },) => {
    expect($({ str: '((text))', trimmer: '((', },),).toBe('text))',);
  });

  test('handles very long strings efficiently', ({ expect, },) => {
    const longStr = 'a'.repeat(1000,) + 'text' + 'a'.repeat(1000,);
    expect($({ str: longStr, trimmer: 'a', },),).toBe('text',);
  });

  test('trimmer with special regex characters', ({ expect, },) => {
    expect($({ str: '.*.', trimmer: '.*', },),).toBe('.',);
  });

  test('handles multiple consecutive multi-char patterns at start only', ({ expect, },) => {
    expect($({ str: 'xxxyyyText', trimmer: 'xxx', },),).toBe('yyyText',);
  });

  test('handles multiple consecutive multi-char patterns at end only', ({ expect, },) => {
    expect($({ str: 'Textxxxyyy', trimmer: 'yyy', },),).toBe('Textxxx',);
  });
});
