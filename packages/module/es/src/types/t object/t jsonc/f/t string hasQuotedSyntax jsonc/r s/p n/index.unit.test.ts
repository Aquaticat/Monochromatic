import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import type {
  $ as StringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

// oxlint-disable-next-line prefer-destructuring -- Deep property access is clearer than destructuring for this nested path
const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.$;

await describe({
  name: $.name,
  children: [
    //region Basic parsing with comments
    describe({
      name: 'basic parsing with comments',
      children: [
        it({
          name: 'clean array with leading comments',
          fn: async () => {
            const input = `// Leading comment
[1, 2, 3]` as StringJsonc;
            const result = $({ value: input, },);

            expect(result.comment?.commentValue,).toContain('Leading comment',);
            if ('json' in result)
              expect(result.json,).toEqual([1, 2, 3,],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'clean object with leading comments',
          fn: async () => {
            const input = `/* Block comment */
{"a": 1, "b": 2}` as StringJsonc;
            const result = $({ value: input, },);

            expect(result.comment?.commentValue,).toContain('Block comment',);
            if ('json' in result)
              expect(result.json,).toEqual({ a: 1, b: 2, },);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),
      ],
    },),
    //endregion Basic parsing with comments

    //region Fast-path optimization
    describe({
      name: 'fast-path optimization',
      children: [
        it({
          name: 'array with boundary trailing comma uses fast-path',
          fn: async () => {
            const input = '[1, 2, 3, ]' as StringJsonc;
            const result = $({ value: input, },);

            // Fast-path successfully parses
            if ('json' in result)
              expect(result.json,).toEqual([1, 2, 3,],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'object with boundary trailing comma uses fast-path',
          fn: async () => {
            const input = '{"a": 1, "b": 2, }' as StringJsonc;
            const result = $({ value: input, },);

            // Fast-path successfully parses
            if ('json' in result)
              expect(result.json,).toEqual({ a: 1, b: 2, },);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'array with leading comment and trailing comma',
          fn: async () => {
            const input = `// Comment
[10, 20, 30, ]` as StringJsonc;
            const result = $({ value: input, },);

            expect(result.comment?.commentValue,).toContain('Comment',);
            if ('json' in result)
              expect(result.json,).toEqual([10, 20, 30,],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'object with leading comment and trailing comma',
          fn: async () => {
            const input = `/* Setup */
{"enabled": true, "count": 5, }` as StringJsonc;
            const result = $({ value: input, },);

            expect(result.comment?.commentValue,).toContain('Setup',);
            if ('json' in result)
              expect(result.json,).toEqual({ enabled: true, count: 5, },);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'nested structures with trailing comma',
          fn: async () => {
            const input =
              '{"items": [1, 2, 3], "config": {"debug": true}, }' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result) {
              expect(result.json,).toEqual({
                items: [1, 2, 3,],
                config: { debug: true, },
              },);
            }
            else {
              throw new Error('Expected fast-path PlainJson result',);
            }
          },
        },),
      ],
    },),
    //endregion Fast-path optimization

    //region Custom parser fallback
    describe({
      name: 'custom parser fallback',
      children: [
        it({
          name: 'array with internal comments forces custom parser',
          fn: async () => {
            const input = '[1, /* mid */ 2, 3]' as StringJsonc;
            const result = $({ value: input, },);

            // Custom parser handles this
            if ('value' in result) {
              expect(Array.isArray(result.value,),).toBe(true,);
              expect(result.value,).toBeDefined();
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),

        it({
          name: 'object with internal comments forces custom parser',
          fn: async () => {
            const input = '{"a": 1, /* between */ "b": 2}' as StringJsonc;
            const result = $({ value: input, },);

            // Custom parser handles this
            if ('value' in result) {
              expect(result.value instanceof Map,).toBe(true,);
              expect(result.value,).toBeDefined();
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),

        it({
          name: 'array with inline comment after value',
          fn: async () => {
            const input = `[
  1, // First item
  2, // Second item
  3  // Third item
]` as StringJsonc;
            const result = $({ value: input, },);

            if ('value' in result) {
              expect(Array.isArray(result.value,),).toBe(true,);
              expect(result.value,).toBeDefined();
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),

        it({
          name: 'object with inline comments',
          fn: async () => {
            const input = `{
  "name": "test", // The name
  "active": true   // Status
}` as StringJsonc;
            const result = $({ value: input, },);

            if ('value' in result) {
              expect(result.value instanceof Map,).toBe(true,);
              expect(result.value,).toBeDefined();
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),

        it({
          name: 'array with multiple trailing commas needs custom parser',
          fn: async () => {
            const input = '[1, 2, , ]' as StringJsonc;

            // This should throw or be handled by custom parser
            expect(() => $({ value: input, },)).toThrow();
          },
        },),
      ],
    },),
    //endregion Custom parser fallback

    //region Complex nested structures
    describe({
      name: 'complex nested structures',
      children: [
        it({
          name: 'deeply nested object with comments',
          fn: async () => {
            const input = `{
  // Application config
  "app": {
    "name": "MyApp", /* Name */
    "settings": {
      "theme": "dark", // UI theme
      "features": [
        "auth", // Authentication
        "api"   // API integration
      ]
    }
  }
}` as StringJsonc;
            const result = $({ value: input, },);

            if ('value' in result) {
              expect(result.value instanceof Map,).toBe(true,);
              expect(result.value,).toBeDefined();
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),

        it({
          name: 'array of objects with comments',
          fn: async () => {
            const input = `[
  {"id": 1}, // First
  {"id": 2}, // Second
  {"id": 3}  // Third
]` as StringJsonc;
            const result = $({ value: input, },);

            if ('value' in result) {
              expect(Array.isArray(result.value,),).toBe(true,);
              expect(result.value,).toBeDefined();
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),

        it({
          name: 'mixed nesting with trailing commas',
          fn: async () => {
            const input = `{
  "data": [
    1,
    2,
    3,
  ],
  "meta": {
    "count": 3,
  },
}` as StringJsonc;
            const result = $({ value: input, },);

            if ('value' in result) {
              expect(result.value instanceof Map,).toBe(true,);
              expect(result.value,).toBeDefined();
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),
      ],
    },),
    //endregion Complex nested structures

    //region Error cases
    describe({
      name: 'error cases',
      children: [
        it({
          name: 'invalid start character throws',
          fn: async () => {
            const input = 'invalid' as StringJsonc;

            expect(() => $({ value: input, },)).toThrow(
              'invalid jsonc, after removing comments and trimming, nothing except [ or { shall be at the start',
            );
          },
        },),

        it({
          name: 'number at start throws',
          fn: async () => {
            const input = '123' as StringJsonc;

            expect(() => $({ value: input, },)).toThrow(
              'invalid jsonc, after removing comments and trimming, nothing except [ or { shall be at the start',
            );
          },
        },),

        it({
          name: 'string at start throws',
          fn: async () => {
            const input = '"hello"' as StringJsonc;

            expect(() => $({ value: input, },)).toThrow(
              'invalid jsonc, after removing comments and trimming, nothing except [ or { shall be at the start',
            );
          },
        },),

        it({
          name: 'trailing content after array throws',
          fn: async () => {
            const input = '[1, 2, 3] extra' as StringJsonc;

            expect(() => $({ value: input, },)).toThrow(
              'unexpected trailing content after array',
            );
          },
        },),

        it({
          name: 'trailing content after object throws',
          fn: async () => {
            const input = '{"a": 1} extra' as StringJsonc;

            expect(() => $({ value: input, },)).toThrow(
              'unexpected trailing content after object',
            );
          },
        },),

        it({
          name: 'comment then trailing content after array throws',
          fn: async () => {
            const input = '[1, 2] // comment\nextra' as StringJsonc;

            expect(() => $({ value: input, },)).toThrow(
              'unexpected trailing content after array',
            );
          },
        },),

        it({
          name: 'comment then trailing content after object throws',
          fn: async () => {
            const input = '{"x": 1} /* comment */ more' as StringJsonc;

            expect(() => $({ value: input, },)).toThrow(
              'unexpected trailing content after object',
            );
          },
        },),
      ],
    },),
    //endregion Error cases

    //region Edge cases
    describe({
      name: 'edge cases',
      children: [
        it({
          name: 'empty array',
          fn: async () => {
            const input = '[]' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual([],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'empty object',
          fn: async () => {
            const input = '{}' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual({},);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'only whitespace before array',
          fn: async () => {
            const input = '   \n\t  [1, 2]' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual([1, 2,],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'only whitespace before object',
          fn: async () => {
            const input = '   \n\t  {"a": 1}' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual({ a: 1, },);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'multiple leading comments',
          fn: async () => {
            const input = `// First comment
// Second comment
/* Block comment */
[1, 2, 3]` as StringJsonc;
            const result = $({ value: input, },);

            expect(result.comment,).toBeTruthy();
            if ('json' in result)
              expect(result.json,).toEqual([1, 2, 3,],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'only comments after structure',
          fn: async () => {
            const input = `[1, 2, 3]
// Trailing comment
/* Another comment */` as StringJsonc;
            const result = $({ value: input, },);

            // Trailing comments force custom parser path (JSON.parse can't handle them)
            // Custom parser returns Array variant with value property
            if ('value' in result) {
              expect(Array.isArray(result.value,),).toBe(true,);
              expect(result.value,).toEqual([
                { value: 1, },
                { value: 2, },
                { value: 3, },
              ],);
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),
      ],
    },),
    //endregion Edge cases

    //region Integration with re-exported parsers
    describe({
      name: 'integration with re-exported parsers',
      children: [
        it({
          name: 'uses customParserForArray internally',
          fn: async () => {
            const input = '[1, /* comment */ 2]' as StringJsonc;
            const result = $({ value: input, },);

            // Verify it produces expected structure from custom parser
            if ('value' in result) {
              expect(Array.isArray(result.value,),).toBe(true,);
              expect(result,).toHaveProperty('value',);
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),

        it({
          name: 'uses customParserForRecord internally',
          fn: async () => {
            const input = '{"a": 1, /* comment */ "b": 2}' as StringJsonc;
            const result = $({ value: input, },);

            // Verify it produces expected structure from custom parser
            if ('value' in result) {
              expect(result.value instanceof Map,).toBe(true,);
              expect(result,).toHaveProperty('value',);
            }
            else {
              throw new Error('Expected custom parser result with value property',);
            }
          },
        },),

        it({
          name: 'uses startsWithComment for leading comments',
          fn: async () => {
            const input = '// Test\n[1, 2]' as StringJsonc;
            const result = $({ value: input, },);

            // Verify comment was extracted
            expect(result.comment?.commentValue,).toContain('Test',);
          },
        },),

        it({
          name: 'validates with validateNoTrailingContent',
          fn: async () => {
            const input = '[1, 2] garbage' as StringJsonc;

            // Validation should catch trailing content
            expect(() => $({ value: input, },)).toThrow('unexpected trailing content',);
          },
        },),
      ],
    },),
    //endregion Integration with re-exported parsers

    //region Trailing comma boundary detection
    describe({
      name: 'trailing comma boundary detection',
      children: [
        it({
          name: 'trailing comma with whitespace before bracket',
          fn: async () => {
            const input = '[1, 2, 3,   ]' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual([1, 2, 3,],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'trailing comma with newline before bracket',
          fn: async () => {
            const input = `[1, 2, 3,
]` as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual([1, 2, 3,],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'trailing comma with whitespace before brace',
          fn: async () => {
            const input = '{"a": 1, "b": 2,   }' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual({ a: 1, b: 2, },);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'trailing comma with newline before brace',
          fn: async () => {
            const input = `{"a": 1, "b": 2,
}` as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual({ a: 1, b: 2, },);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),

        it({
          name: 'non-trailing comma in middle of array',
          fn: async () => {
            const input = '[1, 2, 3]' as StringJsonc;
            const result = $({ value: input, },);

            // No trailing comma, still works
            if ('json' in result)
              expect(result.json,).toEqual([1, 2, 3,],);
            else
              throw new Error('Expected fast-path PlainJson result',);
          },
        },),
      ],
    },),
    //endregion Trailing comma boundary detection

    //region Type preservation
    describe({
      name: 'type preservation',
      children: [
        it({
          name: 'array result has correct type',
          fn: async () => {
            const input = '[1, 2]' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(Array.isArray(result.json,),).toBe(true,);
            else
              expect(Array.isArray(result.value,),).toBe(true,);
          },
        },),

        it({
          name: 'object result has correct type',
          fn: async () => {
            const input = '{"a": 1}' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(typeof result.json,).toBe('object',);
            else
              expect(result.value instanceof Map,).toBe(true,);
          },
        },),

        it({
          name: 'preserves boolean values',
          fn: async () => {
            const input = '{"active": true, "disabled": false}' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual({ active: true, disabled: false, },);
          },
        },),

        it({
          name: 'preserves null values',
          fn: async () => {
            const input = '{"value": null}' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual({ value: null, },);
          },
        },),

        it({
          name: 'preserves number types',
          fn: async () => {
            const input = '{"int": 42, "float": 3.14, "exp": 1e5}' as StringJsonc;
            const result = $({ value: input, },);

            if ('json' in result)
              expect(result.json,).toEqual({ int: 42, float: 3.14, exp: 1e5, },);
          },
        },),
      ],
    },),
    //endregion Type preservation
  ],
},);
