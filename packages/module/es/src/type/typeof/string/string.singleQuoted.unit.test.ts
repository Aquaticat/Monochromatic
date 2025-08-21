import {
  isDoubleQuotedString,
  isSingleQuotedString,
  logtapeConfiguration,
  logtapeConfigure,
  toDoubleQuotedString,
  toSingleQuotedString,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('string.singleQuoted', () => {
  describe('isSingleQuotedString', () => {
    test('returns true for single-quoted strings', () => {
      expect(isSingleQuotedString("'hello'")).toBe(true);
      expect(isSingleQuotedString("'world'")).toBe(true);
      expect(isSingleQuotedString("''")).toBe(true);
      expect(isSingleQuotedString("'with spaces'")).toBe(true);
      expect(isSingleQuotedString("'multiple words here'")).toBe(true);
      expect(isSingleQuotedString("'123'")).toBe(true);
      expect(isSingleQuotedString("'special !@#$%^&*() characters'")).toBe(true);
    });

    test('returns false for double-quoted strings', () => {
      expect(isSingleQuotedString('"hello"')).toBe(false);
      expect(isSingleQuotedString('"world"')).toBe(false);
      expect(isSingleQuotedString('""')).toBe(false);
    });

    test('returns false for unquoted strings', () => {
      expect(isSingleQuotedString('hello')).toBe(false);
      expect(isSingleQuotedString('world')).toBe(false);
      expect(isSingleQuotedString('')).toBe(false);
      expect(isSingleQuotedString('unquoted text')).toBe(false);
    });

    test('returns false for strings with mismatched quotes', () => {
      expect(isSingleQuotedString("'hello\"")).toBe(false);
      expect(isSingleQuotedString("\"hello'")).toBe(false);
      expect(isSingleQuotedString("'incomplete")).toBe(false);
      expect(isSingleQuotedString("incomplete'")).toBe(false);
    });

    test('returns false for single quote character', () => {
      expect(isSingleQuotedString("'")).toBe(false);
    });

    test('handles nested quotes correctly', () => {
      expect(isSingleQuotedString("'contains \"double\" quotes'")).toBe(true);
      expect(isSingleQuotedString("'has \\'escaped\\' quotes'")).toBe(true);
    });
  });

  describe('isDoubleQuotedString', () => {
    test('returns true for double-quoted strings', () => {
      expect(isDoubleQuotedString('"hello"')).toBe(true);
      expect(isDoubleQuotedString('"world"')).toBe(true);
      expect(isDoubleQuotedString('""')).toBe(true);
      expect(isDoubleQuotedString('"with spaces"')).toBe(true);
      expect(isDoubleQuotedString('"multiple words here"')).toBe(true);
      expect(isDoubleQuotedString('"123"')).toBe(true);
      expect(isDoubleQuotedString('"special !@#$%^&*() characters"')).toBe(true);
    });

    test('returns false for single-quoted strings', () => {
      expect(isDoubleQuotedString("'hello'")).toBe(false);
      expect(isDoubleQuotedString("'world'")).toBe(false);
      expect(isDoubleQuotedString("''")).toBe(false);
    });

    test('returns false for unquoted strings', () => {
      expect(isDoubleQuotedString('hello')).toBe(false);
      expect(isDoubleQuotedString('world')).toBe(false);
      expect(isDoubleQuotedString('')).toBe(false);
      expect(isDoubleQuotedString('unquoted text')).toBe(false);
    });

    test('returns false for strings with mismatched quotes', () => {
      expect(isDoubleQuotedString('"hello\'')).toBe(false);
      expect(isDoubleQuotedString('\'"hello"')).toBe(false);
      expect(isDoubleQuotedString('"incomplete')).toBe(false);
      expect(isDoubleQuotedString('incomplete"')).toBe(false);
    });

    test('returns false for single quote character', () => {
      expect(isDoubleQuotedString('"')).toBe(false);
    });

    test('handles nested quotes correctly', () => {
      expect(isDoubleQuotedString('"contains \'single\' quotes"')).toBe(true);
      expect(isDoubleQuotedString('"has \\"escaped\\" quotes"')).toBe(true);
    });
  });

  describe('toSingleQuotedString', () => {
    test('returns single-quoted strings unchanged', () => {
      expect(toSingleQuotedString("'hello'")).toBe("'hello'");
      expect(toSingleQuotedString("'world'")).toBe("'world'");
      expect(toSingleQuotedString("''")).toBe("''");
      expect(toSingleQuotedString("'with spaces'")).toBe("'with spaces'");
    });

    test('converts double-quoted strings to single-quoted', () => {
      expect(toSingleQuotedString('"hello"')).toBe("'hello'");
      expect(toSingleQuotedString('"world"')).toBe("'world'");
      expect(toSingleQuotedString('""')).toBe("''");
      expect(toSingleQuotedString('"with spaces"')).toBe("'with spaces'");
    });

    test('handles escape sequence conversion', () => {
      expect(toSingleQuotedString('"say \\"hi\\""')).toBe("'say \"hi\"'");
      expect(toSingleQuotedString('"multiple \\"escaped\\" quotes"')).toBe("'multiple \"escaped\" quotes'");
      expect(toSingleQuotedString('"start \\"middle\\" end"')).toBe("'start \"middle\" end'");
    });

    test('throws error for unquoted strings', () => {
      expect(() => toSingleQuotedString('hello')).toThrow(
        'Expected a string to be either already single or double quoted, but got: hello'
      );
      expect(() => toSingleQuotedString('unquoted text')).toThrow(
        'Expected a string to be either already single or double quoted, but got: unquoted text'
      );
      expect(() => toSingleQuotedString('')).toThrow(
        'Expected a string to be either already single or double quoted, but got: '
      );
    });

    test('throws error for malformed quotes', () => {
      expect(() => toSingleQuotedString('"incomplete')).toThrow();
      expect(() => toSingleQuotedString('incomplete"')).toThrow();
      expect(() => toSingleQuotedString("'incomplete")).toThrow();
      expect(() => toSingleQuotedString("incomplete'")).toThrow();
    });

    test('handles special characters', () => {
      expect(toSingleQuotedString('"special !@#$%^&*()"')).toBe("'special !@#$%^&*()'");
      expect(toSingleQuotedString('"line1\\nline2"')).toBe("'line1\\nline2'");
      expect(toSingleQuotedString('"tab\\there"')).toBe("'tab\\there'");
    });
  });

  describe('toDoubleQuotedString', () => {
    test('returns double-quoted strings unchanged', () => {
      expect(toDoubleQuotedString('"hello"')).toBe('"hello"');
      expect(toDoubleQuotedString('"world"')).toBe('"world"');
      expect(toDoubleQuotedString('""')).toBe('""');
      expect(toDoubleQuotedString('"with spaces"')).toBe('"with spaces"');
    });

    test('converts single-quoted strings to double-quoted', () => {
      expect(toDoubleQuotedString("'hello'")).toBe('"hello"');
      expect(toDoubleQuotedString("'world'")).toBe('"world"');
      expect(toDoubleQuotedString("''")).toBe('""');
      expect(toDoubleQuotedString("'with spaces'")).toBe('"with spaces"');
    });

    test('handles escape sequence conversion', () => {
      expect(toDoubleQuotedString("'can\\'t'")).toBe('"can"t"');
      expect(toDoubleQuotedString("'it\\'s working'")).toBe('"it"s working"');
      expect(toDoubleQuotedString("'multiple \\'escaped\\' quotes'")).toBe('"multiple "escaped" quotes"');
    });

    test('throws error for unquoted strings', () => {
      expect(() => toDoubleQuotedString('hello')).toThrow(
        'Expected a string to be either already single or double quoted, but got: hello'
      );
      expect(() => toDoubleQuotedString('unquoted text')).toThrow(
        'Expected a string to be either already single or double quoted, but got: unquoted text'
      );
      expect(() => toDoubleQuotedString('')).toThrow(
        'Expected a string to be either already single or double quoted, but got: '
      );
    });

    test('throws error for malformed quotes', () => {
      expect(() => toDoubleQuotedString('"incomplete')).toThrow();
      expect(() => toDoubleQuotedString('incomplete"')).toThrow();
      expect(() => toDoubleQuotedString("'incomplete")).toThrow();
      expect(() => toDoubleQuotedString("incomplete'")).toThrow();
    });

    test('handles special characters', () => {
      expect(toDoubleQuotedString("'special !@#$%^&*()'")).toBe('"special !@#$%^&*()"');
      expect(toDoubleQuotedString("'line1\\nline2'")).toBe('"line1\\nline2"');
      expect(toDoubleQuotedString("'tab\\there'")).toBe('"tab\\there"');
    });
  });

  describe('round-trip conversion', () => {
    test('maintains content integrity through conversions', () => {
      const original = '"hello world"';
      const singleQuoted = toSingleQuotedString(original);
      const backToDouble = toDoubleQuotedString(singleQuoted);
      expect(backToDouble).toBe(original);
    });

    test('maintains content with escaped quotes', () => {
      const originalDouble = '"say \\"hello\\""';
      const single = toSingleQuotedString(originalDouble);
      const backToDouble = toDoubleQuotedString(single);
      expect(backToDouble).toBe(originalDouble);

      const originalSingle = "'can\\'t stop'";
      const double = toDoubleQuotedString(originalSingle);
      const backToSingle = toSingleQuotedString(double);
      expect(backToSingle).toBe(originalSingle);
    });
  });
});