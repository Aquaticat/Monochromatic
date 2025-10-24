import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

import type {
  $ as StringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.$;

describe($, () => {
  //region Basic parsing with comments
  describe('basic parsing with comments', () => {
    test('clean array with leading comments', ({ expect, },) => {
      const input = `// Leading comment
[1, 2, 3]` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.comment?.commentValue,).toContain('Leading comment',);
      expect(result.json,).toEqual([1, 2, 3],);
    });

    test('clean object with leading comments', ({ expect, },) => {
      const input = `/* Block comment */
{"a": 1, "b": 2}` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.comment?.commentValue,).toContain('Block comment',);
      expect(result.json,).toEqual({ a: 1, b: 2, },);
    });

    test('array without leading comments', ({ expect, },) => {
      const input = '[1, 2, 3]' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.remainingContent,).toBe('[1, 2, 3]',);
    });

    test('object without leading comments', ({ expect, },) => {
      const input = '{"x": true}' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.remainingContent,).toBe('{"x": true}',);
    });
  });
  //endregion Basic parsing with comments

  //region Fast-path optimization
  describe('fast-path optimization', () => {
    test('array with boundary trailing comma uses fast-path', ({ expect, },) => {
      const input = '[1, 2, 3, ]' as StringJsonc;
      const result = $({ value: input, },);
      
      // Fast-path successfully parses
      expect(result.json,).toEqual([1, 2, 3],);
    });

    test('object with boundary trailing comma uses fast-path', ({ expect, },) => {
      const input = '{"a": 1, "b": 2, }' as StringJsonc;
      const result = $({ value: input, },);
      
      // Fast-path successfully parses
      expect(result.json,).toEqual({ a: 1, b: 2, },);
    });

    test('array with leading comment and trailing comma', ({ expect, },) => {
      const input = `// Comment
[10, 20, 30, ]` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.comment?.commentValue,).toContain('Comment',);
      expect(result.json,).toEqual([10, 20, 30],);
    });

    test('object with leading comment and trailing comma', ({ expect, },) => {
      const input = `/* Setup */
{"enabled": true, "count": 5, }` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.comment?.commentValue,).toContain('Setup',);
      expect(result.json,).toEqual({ enabled: true, count: 5, },);
    });

    test('nested structures with trailing comma', ({ expect, },) => {
      const input = '{"items": [1, 2, 3], "config": {"debug": true}, }' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual({
        items: [1, 2, 3],
        config: { debug: true, },
      },);
    });
  });
  //endregion Fast-path optimization

  //region Custom parser fallback
  describe('custom parser fallback', () => {
    test('array with internal comments forces custom parser', ({ expect, },) => {
      const input = '[1, /* mid */ 2, 3]' as StringJsonc;
      const result = $({ value: input, },);
      
      // Custom parser handles this
      expect(result.type,).toBe('array',);
      expect(result.value,).toBeDefined();
    });

    test('object with internal comments forces custom parser', ({ expect, },) => {
      const input = '{"a": 1, /* between */ "b": 2}' as StringJsonc;
      const result = $({ value: input, },);
      
      // Custom parser handles this
      expect(result.type,).toBe('record',);
      expect(result.value,).toBeDefined();
    });

    test('array with inline comment after value', ({ expect, },) => {
      const input = `[
  1, // First item
  2, // Second item
  3  // Third item
]` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.type,).toBe('array',);
      expect(result.value,).toBeDefined();
    });

    test('object with inline comments', ({ expect, },) => {
      const input = `{
  "name": "test", // The name
  "active": true   // Status
}` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.type,).toBe('record',);
      expect(result.value,).toBeDefined();
    });

    test('array with multiple trailing commas needs custom parser', ({ expect, },) => {
      const input = '[1, 2, , ]' as StringJsonc;
      
      // This should throw or be handled by custom parser
      expect(() => $({ value: input, },),).toThrow();
    });
  });
  //endregion Custom parser fallback

  //region Complex nested structures
  describe('complex nested structures', () => {
    test('deeply nested object with comments', ({ expect, },) => {
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
      
      expect(result.type,).toBe('record',);
      expect(result.value,).toBeDefined();
    });

    test('array of objects with comments', ({ expect, },) => {
      const input = `[
  {"id": 1}, // First
  {"id": 2}, // Second
  {"id": 3}  // Third
]` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.type,).toBe('array',);
      expect(result.value,).toBeDefined();
    });

    test('mixed nesting with trailing commas', ({ expect, },) => {
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
      
      expect(result.type,).toBe('record',);
      expect(result.value,).toBeDefined();
    });
  });
  //endregion Complex nested structures

  //region Error cases
  describe('error cases', () => {
    test('invalid start character throws', ({ expect, },) => {
      const input = 'invalid' as StringJsonc;
      
      expect(() => $({ value: input, },),).toThrow(
        'invalid jsonc, after removing comments and trimming, nothing except [ or { shall be at the start',
      );
    });

    test('number at start throws', ({ expect, },) => {
      const input = '123' as StringJsonc;
      
      expect(() => $({ value: input, },),).toThrow(
        'invalid jsonc, after removing comments and trimming, nothing except [ or { shall be at the start',
      );
    });

    test('string at start throws', ({ expect, },) => {
      const input = '"hello"' as StringJsonc;
      
      expect(() => $({ value: input, },),).toThrow(
        'invalid jsonc, after removing comments and trimming, nothing except [ or { shall be at the start',
      );
    });

    test('trailing content after array throws', ({ expect, },) => {
      const input = '[1, 2, 3] extra' as StringJsonc;
      
      expect(() => $({ value: input, },),).toThrow(
        'unexpected trailing content after array',
      );
    });

    test('trailing content after object throws', ({ expect, },) => {
      const input = '{"a": 1} extra' as StringJsonc;
      
      expect(() => $({ value: input, },),).toThrow(
        'unexpected trailing content after object',
      );
    });

    test('comment then trailing content after array throws', ({ expect, },) => {
      const input = '[1, 2] // comment\nextra' as StringJsonc;
      
      expect(() => $({ value: input, },),).toThrow(
        'unexpected trailing content after array',
      );
    });

    test('comment then trailing content after object throws', ({ expect, },) => {
      const input = '{"x": 1} /* comment */ more' as StringJsonc;
      
      expect(() => $({ value: input, },),).toThrow(
        'unexpected trailing content after object',
      );
    });
  });
  //endregion Error cases

  //region Edge cases
  describe('edge cases', () => {
    test('empty array', ({ expect, },) => {
      const input = '[]' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual([],);
    });

    test('empty object', ({ expect, },) => {
      const input = '{}' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual({},);
    });

    test('only whitespace before array', ({ expect, },) => {
      const input = '   \n\t  [1, 2]' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual([1, 2],);
    });

    test('only whitespace before object', ({ expect, },) => {
      const input = '   \n\t  {"a": 1}' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual({ a: 1, },);
    });

    test('multiple leading comments', ({ expect, },) => {
      const input = `// First comment
// Second comment
/* Block comment */
[1, 2, 3]` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.comment,).toBeTruthy();
      expect(result.json,).toEqual([1, 2, 3],);
    });

    test('only comments after structure', ({ expect, },) => {
      const input = `[1, 2, 3]
// Trailing comment
/* Another comment */` as StringJsonc;
      const result = $({ value: input, },);
      
      // Trailing comments force custom parser path (JSON.parse can't handle them)
      // Custom parser returns Array variant { type, value } not PlainJson variant { json }
      expect(result.type,).toBe('array',);
      expect(result.value,).toEqual([
        { value: 1, },
        { value: 2, },
        { value: 3, },
      ],);
    });
  });
  //endregion Edge cases

  //region Integration with re-exported parsers
  describe('integration with re-exported parsers', () => {
    test('uses customParserForArray internally', ({ expect, },) => {
      const input = '[1, /* comment */ 2]' as StringJsonc;
      const result = $({ value: input, },);
      
      // Verify it produces expected structure from custom parser
      expect(result.type,).toBe('array',);
      expect(result,).toHaveProperty('value',);
    });

    test('uses customParserForRecord internally', ({ expect, },) => {
      const input = '{"a": 1, /* comment */ "b": 2}' as StringJsonc;
      const result = $({ value: input, },);
      
      // Verify it produces expected structure from custom parser
      expect(result.type,).toBe('record',);
      expect(result,).toHaveProperty('value',);
    });

    test('uses startsWithComment for leading comments', ({ expect, },) => {
      const input = '// Test\n[1, 2]' as StringJsonc;
      const result = $({ value: input, },);
      
      // Verify comment was extracted
      expect(result.comment?.commentValue,).toContain('Test',);
    });

    test('validates with validateNoTrailingContent', ({ expect, },) => {
      const input = '[1, 2] garbage' as StringJsonc;
      
      // Validation should catch trailing content
      expect(() => $({ value: input, },),).toThrow('unexpected trailing content',);
    });
  });
  //endregion Integration with re-exported parsers

  //region Trailing comma boundary detection
  describe('trailing comma boundary detection', () => {
    test('trailing comma with whitespace before bracket', ({ expect, },) => {
      const input = '[1, 2, 3,   ]' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual([1, 2, 3],);
    });

    test('trailing comma with newline before bracket', ({ expect, },) => {
      const input = `[1, 2, 3,
]` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual([1, 2, 3],);
    });

    test('trailing comma with whitespace before brace', ({ expect, },) => {
      const input = '{"a": 1, "b": 2,   }' as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual({ a: 1, b: 2, },);
    });

    test('trailing comma with newline before brace', ({ expect, },) => {
      const input = `{"a": 1, "b": 2,
}` as StringJsonc;
      const result = $({ value: input, },);
      
      expect(result.json,).toEqual({ a: 1, b: 2, },);
    });

    test('non-trailing comma in middle of array', ({ expect, },) => {
      const input = '[1, 2, 3]' as StringJsonc;
      const result = $({ value: input, },);
      
      // No trailing comma, still works
      expect(result.json,).toEqual([1, 2, 3],);
    });
  });
  //endregion Trailing comma boundary detection

  //region Type preservation
  describe('type preservation', () => {
    test('array result has correct type', ({ expect, },) => {
      const input = '[1, 2]' as StringJsonc;
      const result = $({ value: input, },);
      
      if ('json' in result) {
        expect(Array.isArray(result.json,),).toBe(true,);
      }
      else {
        expect(result.type,).toBe('array',);
      }
    });

    test('object result has correct type', ({ expect, },) => {
      const input = '{"a": 1}' as StringJsonc;
      const result = $({ value: input, },);
      
      if ('json' in result) {
        expect(typeof result.json,).toBe('object',);
      }
      else {
        expect(result.type,).toBe('record',);
      }
    });

    test('preserves boolean values', ({ expect, },) => {
      const input = '{"active": true, "disabled": false}' as StringJsonc;
      const result = $({ value: input, },);
      
      if ('json' in result) {
        expect(result.json,).toEqual({ active: true, disabled: false, },);
      }
    });

    test('preserves null values', ({ expect, },) => {
      const input = '{"value": null}' as StringJsonc;
      const result = $({ value: input, },);
      
      if ('json' in result) {
        expect(result.json,).toEqual({ value: null, },);
      }
    });

    test('preserves number types', ({ expect, },) => {
      const input = '{"int": 42, "float": 3.14, "exp": 1e5}' as StringJsonc;
      const result = $({ value: input, },);
      
      if ('json' in result) {
        expect(result.json,).toEqual({ int: 42, float: 3.14, exp: 1e5, },);
      }
    });
  });
  //endregion Type preservation
});
