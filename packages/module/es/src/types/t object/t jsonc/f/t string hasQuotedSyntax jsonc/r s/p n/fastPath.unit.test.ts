import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const { tryArrayFastPath, tryObjectFastPath, NO_FAST_PATH, } =
  types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;

describe('fastPath', () => {
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
  });
  //endregion tryArrayFastPath

  //region tryObjectFastPath
  describe(tryObjectFastPath, () => {
    const $ = tryObjectFastPath;

    test('clean object with boundary trailing comma succeeds', ({ expect, },) => {
      const context = { remainingContent: '{"a": 1, "b": 2, }' as StringJsonc, };
      const result = $({ value: '{"a": 1, "b": 2, }', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);

      expect(result.json,).toEqual({ a: 1, b: 2, },);
    });

    test('clean object without trailing comma succeeds', ({ expect, },) => {
      const context = { remainingContent: '{"x": true}' as StringJsonc, };
      const result = $({ value: '{"x": true}', context, },);

      if (typeof result === 'symbol')
        throw new Error('expected parsed result',);

      expect(result.json,).toEqual({ x: true, },);
    });

    test('object with comments returns NO_FAST_PATH', ({ expect, },) => {
      const context = { remainingContent: '{"a": /* c */ 1, }' as StringJsonc, };
      const result = $({ value: '{"a": /* c */ 1, }', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });

    test('empty object with trailing comma', ({ expect, },) => {
      const context = { remainingContent: '{ , }' as StringJsonc, };
      const result = $({ value: '{ , }', context, },);

      expect(result,).toBe(NO_FAST_PATH,);
    });
  });
  //endregion tryObjectFastPath
});
