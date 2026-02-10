import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const $ = types.string.from.array.string.concat.with.string.sync.named.$;

describe('concat with string - synchronous named', () => {
  test('joins multiple strings with a separator', () => {
    expect(
      $({ strings: ['Hello', 'World',], concatWith: ', ', },),
    )
      .toBe(
        'Hello, World',
      );
  });

  test('joins three strings with a separator', () => {
    expect(
      $({ strings: ['a', 'b', 'c',], concatWith: '-', },),
    )
      .toBe(
        'a-b-c',
      );
  });

  test('empty array returns empty string', () => {
    expect($({ strings: [], concatWith: ',', },),).toBe('',);
  });

  test('single element array returns that element', () => {
    expect($({ strings: ['single',], concatWith: ',', },),).toBe('single',);
  });

  test('empty string separator joins without separator', () => {
    expect($({ strings: ['a', 'b', 'c',], concatWith: '', },),).toBe('abc',);
  });

  test('single character separator', () => {
    expect($({ strings: ['one', 'two', 'three',], concatWith: ' ', },),).toBe(
      'one two three',
    );
  });

  test('multi-character separator', () => {
    expect(
      $({ strings: ['first', 'second', 'third',], concatWith: ' - ', },),
    )
      .toBe(
        'first - second - third',
      );
  });

  test('whitespace separator', () => {
    expect($({ strings: ['1', '2', '3',], concatWith: '  ', },),).toBe('1  2  3',);
  });

  test('special characters as separators', () => {
    expect($({ strings: ['a', 'b', 'c',], concatWith: '|||', },),).toBe('a|||b|||c',);
  });

  test('newline as separator', () => {
    expect($({ strings: ['line1', 'line2', 'line3',], concatWith: '\n', },),).toBe(
      'line1\nline2\nline3',
    );
  });

  test('tab as separator', () => {
    expect($({ strings: ['col1', 'col2', 'col3',], concatWith: '\t', },),).toBe(
      'col1\tcol2\tcol3',
    );
  });

  test('handles empty strings in the array', () => {
    expect($({ strings: ['a', '', 'c',], concatWith: ',', },),).toBe('a,,c',);
  });

  test('handles multiple empty strings', () => {
    expect(
      $({ strings: ['', '', '',], concatWith: '-', },),
    )
      .toBe(
        '--',
      );
  });

  test('handles strings with spaces', () => {
    expect(
      $({ strings: ['foo bar', 'baz qux',], concatWith: ', ', },),
    )
      .toBe(
        'foo bar, baz qux',
      );
  });

  test('handles unicode characters', () => {
    expect(
      $({ strings: ['世界', '你好', '世界',], concatWith: ' ', },),
    )
      .toBe(
        '世界 你好 世界',
      );
  });

  test('handles emoji characters', () => {
    expect($({ strings: ['🚀', '🌟', '✨',], concatWith: ' ', },),).toBe('🚀 🌟 ✨',);
  });

  test('handles special regex characters as strings', () => {
    expect(
      $({ strings: ['test.*', 'pattern+', 'more?',], concatWith: '|', },),
    )
      .toBe(
        'test.*|pattern+|more?',
      );
  });

  test('handles numbers in array', () => {
    expect($({ strings: ['1', '2', '3',], concatWith: '-', },),).toBe('1-2-3',);
  });

  test('handles mixed content', () => {
    expect(
      $({ strings: ['Hello', '123', 'World',], concatWith: ' ', },),
    )
      .toBe(
        'Hello 123 World',
      );
  });

  test('handles very long arrays efficiently', () => {
    const largeArray = Array.from({ length: 100, }, (_, index,) => `item${index}`,);
    const result = $({ strings: largeArray, concatWith: ',', },);
    expect(result.startsWith('item0,item1,item2',),).toBe(true,);
    expect(result,).toContain('item50,',);
    expect(result,).toContain(',item99',);
  });

  test('handles very long strings', () => {
    const longString1 = 'a'.repeat(1000,);
    const longString2 = 'b'.repeat(1000,);
    const result = $({ strings: [longString1, longString2,], concatWith: '|', },);
    expect(result,).toBe(`${longString1}|${longString2}`,);
  });

  test('handles dot separator', () => {
    expect($({ strings: ['com', 'example', 'www',], concatWith: '.', },),).toBe(
      'com.example.www',
    );
  });

  test('handles slash separator', () => {
    expect($({ strings: ['home', 'user', 'documents',], concatWith: '/', },),).toBe(
      'home/user/documents',
    );
  });

  test('handles backslash separator', () => {
    expect($({ strings: ['C:', 'Users', 'Documents',], concatWith: '\\', },),).toBe(
      'C:\\Users\\Documents',
    );
  });

  test('handles colon separator', () => {
    expect(
      $({ strings: ['key', 'value', 'extra',], concatWith: ':', },),
    )
      .toBe(
        'key:value:extra',
      );
  });

  test('handles semicolon separator', () => {
    expect(
      $({ strings: ['red', 'green', 'blue',], concatWith: ';', },),
    )
      .toBe(
        'red;green;blue',
      );
  });

  test('handles pipe separator', () => {
    expect($({ strings: ['A', 'B', 'C',], concatWith: '|', },),).toBe('A|B|C',);
  });

  test('handles ampersand separator', () => {
    expect($({ strings: ['foo', 'bar', 'baz',], concatWith: '&', },),).toBe(
      'foo&bar&baz',
    );
  });

  test('handles dash separator', () => {
    expect($({ strings: ['first', 'second', 'third',], concatWith: '-', },),).toBe(
      'first-second-third',
    );
  });

  test('handles underscore separator', () => {
    expect(
      $({ strings: ['variable', 'name', 'here',], concatWith: '_', },),
    )
      .toBe(
        'variable_name_here',
      );
  });

  test('handles equals sign separator', () => {
    expect($({ strings: ['key', 'value',], concatWith: '=', },),).toBe('key=value',);
  });
});
