import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const { tryArrayFastPath, NO_FAST_PATH, } =
  types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;

describe('minion functions', () => {
  //region tryArrayFastPath
  describe(tryArrayFastPath, () => {
    const $ = tryArrayFastPath;

    test('clean array with boundary trailing comma succeeds', ({ expect, },) => {
      const context = { remainingContent: '[1, 2, 3, ]' as StringJsonc, };
      const result = $({ value: '[1, 2, 3, ]', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result, got symbol',);

      expect(result.json,).toEqual([1, 2, 3,],);
    });

    test('clean array without trailing comma succeeds', ({ expect, },) => {
      const context = { remainingContent: '[1, 2, 3]' as StringJsonc, };
      const result = $({ value: '[1, 2, 3]', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result, got symbol',);

      expect(result.json,).toEqual([1, 2, 3,],);
    });

    test('array with internal comments returns NO_FAST_PATH', ({ expect, },) => {
      const context = { remainingContent: '[1, /* comment */ 2, ]' as StringJsonc, };
      const result = $({ value: '[1, /* comment */ 2, ]', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('array with multiple trailing commas returns NO_FAST_PATH', ({ expect, },) => {
      const context = { remainingContent: '[1, 2, , ]' as StringJsonc, };
      const result = $({ value: '[1, 2, , ]', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('non-boundary trailing comma returns NO_FAST_PATH', ({ expect, },) => {
      const context = { remainingContent: '[1, ] extra' as StringJsonc, };
      const result = $({ value: '[1, ] extra', context, },);

      // The trailing comma is not at the very end
      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('malformed JSON returns NO_FAST_PATH', ({ expect, },) => {
      const context = { remainingContent: '[1, 2, undefined, ]' as StringJsonc, };
      const result = $({ value: '[1, 2, undefined, ]', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('symbol narrowing pattern validation', ({ expect, },) => {
      const context = { remainingContent: '[1, /* x */ 2]' as StringJsonc, };
      const result = $({ value: '[1, /* x */ 2]', context, },);

      // Narrow by category first
      if (typeof result === 'symbol') {
        if (result === NO_FAST_PATH)
          expect(result,).toBe(NO_FAST_PATH,);
        else
          throw new Error('unexpected symbol',);
      }
      else {
        throw new Error('expected symbol for this test case',);
      }
    });

    test('context is preserved in successful parse', ({ expect, },) => {
      const context = {
        remainingContent: '[1, 2, ]' as StringJsonc,
        comment: 'leading comment',
      };
      const result = $({ value: '[1, 2, ]', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);

      expect(result.comment,).toBe('leading comment',);
      expect(result.json,).toEqual([1, 2,],);
    });

    test('empty array with trailing comma', ({ expect, },) => {
      const context = { remainingContent: '[ , ]' as StringJsonc, };
      const result = $({ value: '[ , ]', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('nested array with trailing comma', ({ expect, },) => {
      const context = { remainingContent: '[[1, 2], [3, 4], ]' as StringJsonc, };
      const result = $({ value: '[[1, 2], [3, 4], ]', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);

      expect(result.json,).toEqual([[1, 2,], [3, 4,],],);
    });
  },);
  //endregion tryArrayFastPath

  //region tryObjectFastPath
  describe('tryObjectFastPath', () => {
    const $ = exported.tryObjectFastPath;
    const { NO_FAST_PATH, } = exported;

    test('clean object with boundary trailing comma succeeds', ({ expect, },) => {
      const context = { remainingContent: '{"a": 1, "b": 2, }' as StringJsonc, };
      const result = $({ value: '{"a": 1, "b": 2, }', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result, got symbol',);

      expect(result.json,).toEqual({ a: 1, b: 2, },);
    });

    test('clean object without trailing comma succeeds', ({ expect, },) => {
      const context = { remainingContent: '{"a": 1, "b": 2}' as StringJsonc, };
      const result = $({ value: '{"a": 1, "b": 2}', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result, got symbol',);

      expect(result.json,).toEqual({ a: 1, b: 2, },);
    });

    test('object with internal comments returns NO_FAST_PATH', ({ expect, },) => {
      const context = {
        remainingContent: '{"a": 1, /* comment */ "b": 2, }' as StringJsonc,
      };
      const result = $({ value: '{"a": 1, /* comment */ "b": 2, }', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('object with multiple trailing commas returns NO_FAST_PATH', ({ expect, },) => {
      const context = { remainingContent: '{"a": 1, , }' as StringJsonc, };
      const result = $({ value: '{"a": 1, , }', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('non-boundary trailing comma returns NO_FAST_PATH', ({ expect, },) => {
      const context = { remainingContent: '{"a": 1, } extra' as StringJsonc, };
      const result = $({ value: '{"a": 1, } extra', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('malformed JSON returns NO_FAST_PATH', ({ expect, },) => {
      const context = { remainingContent: '{"a": undefined, }' as StringJsonc, };
      const result = $({ value: '{"a": undefined, }', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('symbol narrowing pattern validation', ({ expect, },) => {
      const context = { remainingContent: '{"a": /* x */ 1}' as StringJsonc, };
      const result = $({ value: '{"a": /* x */ 1}', context, },);

      // Narrow by category first
      if (typeof result === 'symbol') {
        if (result === NO_FAST_PATH)
          expect(result,).toBe(NO_FAST_PATH,);
        else
          throw new Error('unexpected symbol',);
      }
      else {
        throw new Error('expected symbol for this test case',);
      }
    });

    test('context is preserved in successful parse', ({ expect, },) => {
      const context = {
        remainingContent: '{"x": 1, }' as StringJsonc,
        comment: { type: 'inline' as const, commentValue: 'leading comment', },
      };
      const result = $({ value: '{"x": 1, }', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);

      expect(result.comment?.commentValue,).toBe('leading comment',);
      expect(result.json,).toEqual({ x: 1, },);
    });

    test('empty object with trailing comma', ({ expect, },) => {
      const context = { remainingContent: '{ , }' as StringJsonc, };
      const result = $({ value: '{ , }', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('nested object with trailing comma', ({ expect, },) => {
      const context = {
        remainingContent: '{"a": {"x": 1}, "b": {"y": 2}, }' as StringJsonc,
      };
      const result = $({ value: '{"a": {"x": 1}, "b": {"y": 2}, }', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);

      expect(result.json,).toEqual({ a: { x: 1, }, b: { y: 2, }, },);
    });

    test('object with array value and trailing comma', ({ expect, },) => {
      const context = { remainingContent: '{"items": [1, 2, 3], }' as StringJsonc, };
      const result = $({ value: '{"items": [1, 2, 3], }', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);

      expect(result.json,).toEqual({ items: [1, 2, 3,], },);
    });
  });
  //endregion tryObjectFastPath

  //region validateNoTrailingContent
  describe('validateNoTrailingContent', () => {
    const $ = exported.validateNoTrailingContent;

    test('empty string does not throw', ({ expect, },) => {
      expect(() => $({ remainingContent: '', containerType: 'array', },)).not.toThrow();
    });

    test('whitespace only does not throw', ({ expect, },) => {
      expect(() => $({ remainingContent: '   \n\t  ', containerType: 'object', },)).not
        .toThrow();
    });

    test('comments only does not throw', ({ expect, },) => {
      expect(() =>
        $({
          remainingContent: '// trailing comment',
          containerType: 'array',
        },)
      )
        .not
        .toThrow();
    });

    test('block comment only does not throw', ({ expect, },) => {
      expect(() =>
        $({
          remainingContent: '/* trailing comment */',
          containerType: 'object',
        },)
      )
        .not
        .toThrow();
    });

    test('trailing content for array throws with array in message', ({ expect, },) => {
      expect(() =>
        $({
          remainingContent: 'extra data',
          containerType: 'array',
        },)
      )
        .toThrow('unexpected trailing content after array',);
    });

    test('trailing content for object throws with object in message', ({ expect, },) => {
      expect(() =>
        $({
          remainingContent: 'extra data',
          containerType: 'object',
        },)
      )
        .toThrow('unexpected trailing content after object',);
    });

    test('long trailing content is truncated to 48 chars', ({ expect, },) => {
      const longContent = 'a'.repeat(100,);

      expect(() =>
        $({
          remainingContent: longContent,
          containerType: 'array',
        },)
      )
        .toThrow(longContent.slice(0, 48,),);
    });

    test('trailing content after comment throws', ({ expect, },) => {
      expect(() =>
        $({
          remainingContent: '// comment\nextra',
          containerType: 'array',
        },)
      )
        .toThrow('unexpected trailing content after array',);
    });

    test('multiple lines of whitespace does not throw', ({ expect, },) => {
      expect(() =>
        $({
          remainingContent: '\n\n\n   \n\n',
          containerType: 'object',
        },)
      )
        .not
        .toThrow();
    });

    test('error message contains actual trailing content', ({ expect, },) => {
      expect(() =>
        $({
          remainingContent: 'specific text',
          containerType: 'array',
        },)
      )
        .toThrow('specific text',);
    });
  });
  //endregion validateNoTrailingContent
});
