import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';

const { tryArrayFastPath, tryObjectFastPath, NO_FAST_PATH, } =
  types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;

describe('fastPath', () => {
  //region tryArrayFastPath
  describe(tryArrayFastPath, () => {
    const $ = tryArrayFastPath;

    test('clean array with boundary trailing comma succeeds', () => {
      const context = { remainingContent: '[1, 2, 3, ]' as StringJsonc, };
      const result = $({ value: '[1, 2, 3, ]' as FragmentStringJsonc, context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result, got symbol',);
      if (!('json' in result))
        throw new Error('expected PlainJson result',);

      expect(result.json,).toEqual([1, 2, 3,],);
    });

    test('clean array without trailing comma succeeds', () => {
      const context = { remainingContent: '[1, 2, 3]' as StringJsonc, };
      const result = $({ value: '[1, 2, 3]' as FragmentStringJsonc, context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result, got symbol',);
      if (!('json' in result))
        throw new Error('expected PlainJson result',);

      expect(result.json,).toEqual([1, 2, 3,],);
    });

    test('array with internal comments returns NO_FAST_PATH', () => {
      const context = { remainingContent: '[1, /* comment */ 2, ]' as StringJsonc, };
      const result = $({ value: '[1, /* comment */ 2, ]' as FragmentStringJsonc,
        context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('array with multiple trailing commas returns NO_FAST_PATH', () => {
      const context = { remainingContent: '[1, 2, , ]' as StringJsonc, };
      const result = $({ value: '[1, 2, , ]' as FragmentStringJsonc, context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('non-boundary trailing comma returns NO_FAST_PATH', () => {
      const context = { remainingContent: '[1, ] extra' as StringJsonc, };
      const result = $({ value: '[1, ] extra' as FragmentStringJsonc, context, },);

      // The trailing comma is not at the very end
      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('malformed JSON returns NO_FAST_PATH', () => {
      const context = { remainingContent: '[1, 2, undefined, ]' as StringJsonc, };
      const result = $({ value: '[1, 2, undefined, ]' as FragmentStringJsonc,
        context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('symbol narrowing pattern validation', () => {
      const context = { remainingContent: '[1, /* x */ 2]' as StringJsonc, };
      const result = $({ value: '[1, /* x */ 2]' as FragmentStringJsonc, context, },);

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

    test('context is preserved in successful parse', () => {
      const context = {
        remainingContent: '[1, 2, ]' as StringJsonc,
        comment: { type: 'block', commentValue: 'leading comment', } as Jsonc.Comment,
      };
      const result = $({ value: '[1, 2, ]' as FragmentStringJsonc, context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);

      expect(result.comment?.commentValue,).toBe('leading comment',);
      if ('json' in result)
        expect(result.json,).toEqual([1, 2,],);
      else
        throw new Error('expected PlainJson result',);
    });

    test('empty array with trailing comma', () => {
      const context = { remainingContent: '[ , ]' as StringJsonc, };
      const result = $({ value: '[ , ]' as FragmentStringJsonc, context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });
  },);
  //endregion tryArrayFastPath

  //region tryObjectFastPath
  describe(tryObjectFastPath, () => {
    const $ = tryObjectFastPath;

    test('clean object with boundary trailing comma succeeds', () => {
      const context = { remainingContent: '{"a": 1, "b": 2, }' as StringJsonc, };
      const result = $({ value: '{"a": 1, "b": 2, }' as FragmentStringJsonc, context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);
      if (!('json' in result))
        throw new Error('expected PlainJson result',);

      expect(result.json,).toEqual({ a: 1, b: 2, },);
    });

    test('clean object without trailing comma succeeds', () => {
      const context = { remainingContent: '{"x": true}' as StringJsonc, };
      const result = $({ value: '{"x": true}' as FragmentStringJsonc, context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);
      if (!('json' in result))
        throw new Error('expected PlainJson result',);

      expect(result.json,).toEqual({ x: true, },);
    });

    test('object with comments returns NO_FAST_PATH', () => {
      const context = { remainingContent: '{"a": /* c */ 1, }' as StringJsonc, };
      const result = $({ value: '{"a": /* c */ 1, }' as FragmentStringJsonc, context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('empty object with trailing comma', () => {
      const context = { remainingContent: '{ , }' as StringJsonc, };
      const result = $({ value: '{ , }' as FragmentStringJsonc, context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });
  },);
  //endregion tryObjectFastPath
});
