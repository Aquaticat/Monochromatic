import {
  describe,
  expect,
  test,
} from 'bun:test';
import {
  dedup,
  getProperty,
} from './transform.ts';

//region dedup

describe('dedup', () => {
  test('removes duplicate lines preserving first occurrence order', () => {
    expect(dedup('a\nb\na\nc\nb',),).toBe('a\nb\nc',);
  });

  test('returns empty string unchanged', () => {
    expect(dedup('',),).toBe('',);
  });

  test('returns single line unchanged', () => {
    expect(dedup('only-line',),).toBe('only-line',);
  });

  test('preserves all lines when none are duplicated', () => {
    expect(dedup('alpha\nbeta\ngamma',),).toBe('alpha\nbeta\ngamma',);
  });

  test('handles consecutive duplicate lines', () => {
    expect(dedup('x\nx\nx\ny',),).toBe('x\ny',);
  });

  test('treats lines with different whitespace as distinct', () => {
    expect(dedup('  a\na\n a',),).toBe('  a\na\n a',);
  });

  test('preserves blank lines but deduplicates them', () => {
    expect(dedup('a\n\nb\n\nc',),).toBe('a\n\nb\nc',);
  });
});

//endregion dedup

//region getProperty

describe('getProperty', () => {
  test('extracts a top-level string property', () => {
    /** JSON with a simple string value */
    const json = JSON.stringify({ name: 'Alice', },);
    expect(getProperty('.name', json,),).toBe('Alice',);
  });

  test('extracts a nested property via dot-path', () => {
    /** JSON with nested structure */
    const json = JSON.stringify({ settings: { theme: 'dark', }, },);
    expect(getProperty('.settings.theme', json,),).toBe('dark',);
  });

  test('stringifies non-string values (number)', () => {
    /** JSON with a numeric value that should be stringified */
    const json = JSON.stringify({ count: 42, },);
    expect(getProperty('.count', json,),).toBe('42',);
  });

  test('stringifies array values with pretty printing', () => {
    /** JSON with an array value */
    const json = JSON.stringify({ items: [1, 2, 3,], },);
    expect(getProperty('.items', json,),).toBe(JSON.stringify([1, 2, 3,], null, 2,),);
  });

  test('stringifies object values with pretty printing', () => {
    /** JSON with a nested object to extract */
    const json = JSON.stringify({ nested: { a: 1, b: 2, }, },);
    expect(getProperty('.nested', json,),).toBe(
      JSON.stringify({ a: 1, b: 2, }, null, 2,),
    );
  });

  test('returns undefined for missing paths', () => {
    /** JSON where the requested path does not exist */
    const json = JSON.stringify({ exists: true, },);
    // dot-prop returns undefined for missing keys; getProperty passes it through
    expect(getProperty('.missing', json,),).toBeUndefined();
  });

  test('throws on invalid JSON input', () => {
    expect(() => getProperty('.key', 'not-json',)).toThrow();
  });

  test('handles boolean values', () => {
    /** JSON with a boolean value */
    const json = JSON.stringify({ active: true, },);
    expect(getProperty('.active', json,),).toBe('true',);
  });

  test('handles null values', () => {
    /** JSON with an explicit null */
    const json = JSON.stringify({ value: null, },);
    expect(getProperty('.value', json,),).toBe('null',);
  });

  test('handles deeply nested paths', () => {
    /** JSON with three levels of nesting */
    const json = JSON.stringify({ a: { b: { c: 'deep', }, }, },);
    expect(getProperty('.a.b.c', json,),).toBe('deep',);
  });
});

//endregion getProperty
