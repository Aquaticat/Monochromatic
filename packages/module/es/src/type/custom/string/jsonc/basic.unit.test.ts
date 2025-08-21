import {
  type jsonc,
  type JsoncArray,
  type JsoncComment,
  type JsoncNumber,
  type JsoncRecord,
  type JsoncString,
  jsoncToParsedJsonc,
  type JsoncValue,
  // Logging library used.
  logtapeConfiguration,
  logtapeConfigure,
  parsedJsoncToJsonc,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe('JSONC Parser and Serializer', () => {
  describe('jsoncToParsedJsonc', () => {
    test('parses simple string value', () => {
      const input = '"hello world"' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'string',
        value: 'hello world',
      },);
    });

    test('parses number value', () => {
      const input = '42' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'number',
        value: 42,
      },);
    });

    test('parses negative and decimal numbers', () => {
      const negativeInput = '-42.5' as jsonc;
      const scientificInput = '1.23e-4' as jsonc;

      expect(jsoncToParsedJsonc(negativeInput,),).toEqual({
        type: 'number',
        value: -42.5,
      },);

      expect(jsoncToParsedJsonc(scientificInput,),).toEqual({
        type: 'number',
        value: 1.23e-4,
      },);
    });

    test('parses boolean values', () => {
      const trueInput = 'true' as jsonc;
      const falseInput = 'false' as jsonc;

      expect(jsoncToParsedJsonc(trueInput,),).toEqual({
        type: 'boolean',
        value: true,
      },);

      expect(jsoncToParsedJsonc(falseInput,),).toEqual({
        type: 'boolean',
        value: false,
      },);
    });

    test('parses null value', () => {
      const input = 'null' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'null',
        value: null,
      },);
    });

    test('parses empty array', () => {
      const input = '[]' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'array',
        value: [],
      },);
    });

    test('parses simple array', () => {
      const input = '[1, 2, "three"]' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'array',
        value: [
          { type: 'number', value: 1, },
          { type: 'number', value: 2, },
          { type: 'string', value: 'three', },
        ],
      },);
    });

    test('parses empty object', () => {
      const input = '{}' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'record',
        value: [],
      },);
    });

    test('parses simple object', () => {
      const input = '{"a": 1, "b": "hello"}' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'record',
        value: [
          {
            recordKey: { type: 'string', value: 'a', },
            recordValue: { type: 'number', value: 1, },
          },
          {
            recordKey: { type: 'string', value: 'b', },
            recordValue: { type: 'string', value: 'hello', },
          },
        ],
      },);
    });

    test('parses inline comments', () => {
      const input = '// This is a comment\n"hello"' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'string',
        value: 'hello',
        comment: {
          type: 'inline',
          commentValue: ' This is a comment',
        },
      },);
    });

    test('parses block comments', () => {
      const input = '/* This is a block comment */ "hello"' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'string',
        value: 'hello',
        comment: {
          type: 'block',
          commentValue: ' This is a block comment ',
        },
      },);
    });

    test('parses multiple inline comments', () => {
      const input = '// Comment 1\n// Comment 2\n"hello"' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'string',
        value: 'hello',
        comment: {
          type: 'inline',
          commentValue: ' Comment 1\n Comment 2',
        },
      },);
    });

    test('parses mixed comments', () => {
      const input = '// Inline comment\n/* Block comment */ "hello"' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'string',
        value: 'hello',
        comment: {
          type: 'mixed',
          commentValue: ' Inline comment\n Block comment ',
        },
      },);
    });

    test('parses object with comments on keys and values', () => {
      const input = `{
        // Key comment
        "a": 1,
        "b": /* Value comment */ 2
      }` as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result.type,).toBe('record',);
      const record = result as JsoncRecord;
      expect(record.value,).toHaveLength(2,);

      // First entry with key comment
      expect(record.value[0].recordKey.comment?.type,).toBe('inline',);
      expect(record.value[0].recordKey.comment?.commentValue,).toBe(' Key comment',);

      // Second entry with value comment
      expect(record.value[1].recordValue.comment?.type,).toBe('block',);
      expect(record.value[1].recordValue.comment?.commentValue,).toBe(' Value comment ',);
    });

    test('parses array with comments', () => {
      const input = `[
        1,
        // Comment before 2
        2,
        /* Block comment */ 3
      ]` as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result.type,).toBe('array',);
      const array = result as JsoncArray;
      expect(array.value,).toHaveLength(3,);

      expect(array.value[0],).toEqual({ type: 'number', value: 1, },);
      expect(array.value[1],).toEqual({
        type: 'number',
        value: 2,
        comment: {
          type: 'inline',
          commentValue: ' Comment before 2',
        },
      },);
      expect(array.value[2],).toEqual({
        type: 'number',
        value: 3,
        comment: {
          type: 'block',
          commentValue: ' Block comment ',
        },
      },);
    });

    test('handles whitespace correctly', () => {
      const input = '  \n  "hello"  \n  ' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'string',
        value: 'hello',
      },);
    });

    test('handles escaped quotes in strings', () => {
      const input = '"He said \\"Hello\\""' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result,).toEqual({
        type: 'string',
        value: 'He said "Hello"',
      },);
    });

    test('handles deeply nested structures', () => {
      const input = '{"a": {"b": {"c": [1, 2, {"d": "deep"}]}}}' as jsonc;
      const result = jsoncToParsedJsonc(input,);

      expect(result.type,).toBe('record',);
      const parsed = result as JsoncRecord;
      expect(parsed.value,).toHaveLength(1,);
      expect(parsed.value[0].recordValue.type,).toBe('record',);
    });

    test('throws on invalid JSON syntax', () => {
      const input = '{"invalid": }' as jsonc;
      expect(() => jsoncToParsedJsonc(input,)).toThrow();
    });

    test('throws on unexpected content after JSON', () => {
      const input = '"valid" extra' as jsonc;
      expect(() => jsoncToParsedJsonc(input,)).toThrow();
    });

    test('parses complex example from specification', () => {
      const input = `// Top level comment
      // More comment
      {
        // Comment for key 'a'
        "a": /* inline comment */ 1,
        "b": 2,
        "c": [
          1,
          // Comment for item
          2,
          3
        ]
      }` as jsonc;

      const result = jsoncToParsedJsonc(input,);

      expect(result.type,).toBe('record',);
      const record = result as JsoncRecord;
      expect(record.comment?.type,).toBe('inline',);
      expect(record.comment?.commentValue,).toBe(' Top level comment\n More comment',);
      expect(record.value,).toHaveLength(3,);
    });
  });

  describe('parsedJsoncToJsonc', () => {
    test('serializes simple values', () => {
      const stringValue: JsoncString = { type: 'string', value: 'hello', };
      const numberValue: JsoncNumber = { type: 'number', value: 42, };

      expect(parsedJsoncToJsonc(stringValue,),).toBe('"hello"',);
      expect(parsedJsoncToJsonc(numberValue,),).toBe('42',);
    });

    test('serializes values with comments', () => {
      const valueWithComment: JsoncString = {
        type: 'string',
        value: 'hello',
        comment: {
          type: 'inline',
          commentValue: ' This is a comment',
        },
      };

      const result = parsedJsoncToJsonc(valueWithComment,);
      expect(result,).toBe('// This is a comment\n"hello"',);
    });

    test('serializes empty structures', () => {
      const emptyArray: JsoncArray = { type: 'array', value: [], };
      const emptyRecord: JsoncRecord = { type: 'record', value: [], };

      expect(parsedJsoncToJsonc(emptyArray,),).toBe('[]',);
      expect(parsedJsoncToJsonc(emptyRecord,),).toBe('{}',);
    });

    test('serializes complex structures with comments', () => {
      const complexValue: JsoncRecord = {
        type: 'record',
        comment: {
          type: 'inline',
          commentValue: ' Top comment',
        },
        value: [
          {
            recordKey: {
              type: 'string',
              value: 'name',
              comment: {
                type: 'inline',
                commentValue: ' Key comment',
              },
            },
            recordValue: {
              type: 'string',
              value: 'test',
              comment: {
                type: 'block',
                commentValue: ' value comment ',
              },
            },
          },
        ],
      };

      const result = parsedJsoncToJsonc(complexValue,);
      expect(result,).toContain('// Top comment',);
      expect(result,).toContain('// Key comment',);
      expect(result,).toContain('/* value comment */',);
    });
  });

  describe('round-trip parsing', () => {
    test('maintains structure through parse-serialize cycle', () => {
      const originalJsonc = `// Top comment
      {
        "name": "test",
        "items": [1, 2, 3]
      }` as jsonc;

      const parsed = jsoncToParsedJsonc(originalJsonc,);
      const reserialized = parsedJsoncToJsonc(parsed,);
      const reparsed = jsoncToParsedJsonc(reserialized,);

      // Structure should be preserved
      expect(reparsed.type,).toBe('record',);
      expect((reparsed as JsoncRecord).comment?.type,).toBe('inline',);
      expect((reparsed as JsoncRecord).value,).toHaveLength(2,);
    });

    test('handles various comment placements', () => {
      const jsonc = `{
        // Before key
        "a": 1,
        "b": /* inline */ 2
      }` as jsonc;

      const parsed = jsoncToParsedJsonc(jsonc,);
      expect(parsed.type,).toBe('record',);

      const record = parsed as JsoncRecord;
      expect(record.value[0].recordKey.comment?.type,).toBe('inline',);
      expect(record.value[1].recordValue.comment?.type,).toBe('block',);
    });
  });
});
