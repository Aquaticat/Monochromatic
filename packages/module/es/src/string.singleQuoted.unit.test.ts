import { toSingleQuotedString, } from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe(toSingleQuotedString, () => {
  test('returns single-quoted strings unchanged', () => {
    expect(toSingleQuotedString("'hello'",),).toBe("'hello'",);
    expect(toSingleQuotedString("'test with spaces'",),).toBe("'test with spaces'",);
    expect(toSingleQuotedString("''",),).toBe("''",);
  });

  test('converts double-quoted strings to single-quoted', () => {
    expect(toSingleQuotedString('"hello"',),).toBe("'hello'",);
    expect(toSingleQuotedString('"test with spaces"',),).toBe("'test with spaces'",);
    expect(toSingleQuotedString('""',),).toBe("''",);
  });

  test('handles escaped quotes correctly', () => {
    expect(toSingleQuotedString(String.raw`"string with \"escaped\" quotes"`,),).toBe(
      "'string with 'escaped' quotes'",
    );
    expect(toSingleQuotedString(String.raw`"mixed \"quotes\""`,),).toBe(
      "'mixed 'quotes''",
    );
  });

  test('throws error for non-quoted strings', () => {
    expect(() => toSingleQuotedString('hello',)).toThrow(Error,);
    expect(() => toSingleQuotedString('not quoted',)).toThrow(Error,);
    expect(() => toSingleQuotedString('',)).toThrow(Error,);
  });

  test('throws error for improperly quoted strings', () => {
    expect(() => toSingleQuotedString('\'mismatched"',)).toThrow(Error,);
    expect(() => toSingleQuotedString('"mismatched\'',)).toThrow(Error,);
  });
},);
