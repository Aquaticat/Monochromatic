import { describe, expect, test } from 'vitest';
import { stripJsonc } from './jsonc.strip.ts';

describe(stripJsonc, () => {
  test('should return an empty string if input is empty', () => {
    expect(stripJsonc('')).toBe('');
  });

  test('should strip single-line comments', () => {
    const jsonc = `
    {
      // this is a comment
      "foo": "bar"
    }
    `;
    const expected = `
    {
      
      "foo": "bar"
    }
    `;
    expect(stripJsonc(jsonc)).toBe(expected);
  });

  test('should strip block comments', () => {
    const jsonc = `
    {
      /* this is a
         multiline comment */
      "foo": "bar"
    }
    `;
    const expected = `
    {
      
      "foo": "bar"
    }
    `;
    expect(stripJsonc(jsonc)).toBe(expected);
  });

  test('should not strip comments inside strings', () => {
    const jsonc = `{ "url": "http://example.com", "comment": "/* not a comment */" }`;
    expect(stripJsonc(jsonc)).toBe(jsonc);
  });

  test('should handle escaped quotes in strings', () => {
    const jsonc = `{ "key": "value with \\" a quote" }`;
    expect(stripJsonc(jsonc)).toBe(jsonc);
  });

  test('should strip trailing commas from objects', () => {
    const jsonc = `{ "foo": "bar", }`;
    const expected = `{ "foo": "bar" }`;
    expect(stripJsonc(jsonc)).toBe(expected);
  });

  test('should strip trailing commas from arrays', () => {
    const jsonc = `[ "foo", "bar", ]`;
    const expected = `[ "foo", "bar" ]`;
    expect(stripJsonc(jsonc)).toBe(expected);
  });

  test('should handle multiple trailing commas', () => {
    const jsonc = `{ "foo": "bar",, }`;
    const expected = `{ "foo": "bar" }`;
    expect(stripJsonc(jsonc)).toBe(expected);
  });

  test('should strip both comments and trailing commas', () => {
    const jsonc = `
    {
      // comment
      "foo": "bar", /* another comment */
      "baz": [
        1,
        2, // trailing comma in array
      ], // trailing comma in object
    }
    `;
    const expected = `
    {
      
      "foo": "bar", 
      "baz": [
        1,
        2 
      ] 
    }
    `;
    expect(stripJsonc(jsonc)).toBe(expected.trim());
  });

  test('should handle jsonc with no comments or trailing commas', () => {
    const json = `{ "foo": "bar", "baz": [1, 2] }`;
    expect(stripJsonc(json)).toBe(json);
  });

  test('should handle complex cases', () => {
    const jsonc = `
    {
      "a": "b", // comment
      "c": "d,}", // string with characters that could be misinterpreted
      "e": [
        /* block comment */
        1,
        2,
      ],
    }
    `;
    const expected = `
    {
      "a": "b", 
      "c": "d,}", 
      "e": [
        
        1,
        2
      ]
    }
    `;
    expect(stripJsonc(jsonc)).toBe(expected.trim());
  });
});
