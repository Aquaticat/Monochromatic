import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';

const { tryArrayFastPath, tryObjectFastPath, NO_FAST_PATH, } =
  types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;

await describe({
  name: 'fastPath',
  children: [
    //region tryArrayFastPath
    describe({
      name: tryArrayFastPath.name,
      children: [
        it({
          name: 'clean array with boundary trailing comma succeeds',
          fn: async () => {
            const context = { remainingContent: '[1, 2, 3, ]' as StringJsonc, };
            const result = tryArrayFastPath({ value: '[1, 2, 3, ]' as FragmentStringJsonc,
              context, },);

            if (typeof result === 'symbol')
              throw new Error('expected parsed result, got symbol',);
            if (!('json' in result))
              throw new Error('expected PlainJson result',);

            expect(result.json,).toEqual([1, 2, 3,],);
          },
        },),

        it({
          name: 'clean array without trailing comma succeeds',
          fn: async () => {
            const context = { remainingContent: '[1, 2, 3]' as StringJsonc, };
            const result = tryArrayFastPath({ value: '[1, 2, 3]' as FragmentStringJsonc,
              context, },);

            if (typeof result === 'symbol')
              throw new Error('expected parsed result, got symbol',);
            if (!('json' in result))
              throw new Error('expected PlainJson result',);

            expect(result.json,).toEqual([1, 2, 3,],);
          },
        },),

        it({
          name: 'array with internal comments returns NO_FAST_PATH',
          fn: async () => {
            const context = {
              remainingContent: '[1, /* comment */ 2, ]' as StringJsonc,
            };
            const result = tryArrayFastPath({
              value: '[1, /* comment */ 2, ]' as FragmentStringJsonc,
              context,
            },);

            expect(result,).toBe(NO_FAST_PATH,);
          },
        },),

        it({
          name: 'array with multiple trailing commas returns NO_FAST_PATH',
          fn: async () => {
            const context = { remainingContent: '[1, 2, , ]' as StringJsonc, };
            const result = tryArrayFastPath({ value: '[1, 2, , ]' as FragmentStringJsonc,
              context, },);

            expect(result,).toBe(NO_FAST_PATH,);
          },
        },),

        it({
          name: 'non-boundary trailing comma returns NO_FAST_PATH',
          fn: async () => {
            const context = { remainingContent: '[1, ] extra' as StringJsonc, };
            const result = tryArrayFastPath({ value: '[1, ] extra' as FragmentStringJsonc,
              context, },);

            // The trailing comma is not at the very end
            expect(result,).toBe(NO_FAST_PATH,);
          },
        },),

        it({
          name: 'malformed JSON returns NO_FAST_PATH',
          fn: async () => {
            const context = { remainingContent: '[1, 2, undefined, ]' as StringJsonc, };
            const result = tryArrayFastPath({
              value: '[1, 2, undefined, ]' as FragmentStringJsonc,
              context,
            },);

            expect(result,).toBe(NO_FAST_PATH,);
          },
        },),

        it({
          name: 'symbol narrowing pattern validation',
          fn: async () => {
            const context = { remainingContent: '[1, /* x */ 2]' as StringJsonc, };
            const result = tryArrayFastPath({
              value: '[1, /* x */ 2]' as FragmentStringJsonc,
              context,
            },);

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
          },
        },),

        it({
          name: 'context is preserved in successful parse',
          fn: async () => {
            const context = {
              remainingContent: '[1, 2, ]' as StringJsonc,
              comment: { type: 'block',
                commentValue: 'leading comment', } as Jsonc.Comment,
            };
            const result = tryArrayFastPath({ value: '[1, 2, ]' as FragmentStringJsonc,
              context, },);

            if (typeof result === 'symbol')
              throw new Error('expected parsed result',);

            expect(result.comment?.commentValue,).toBe('leading comment',);
            if ('json' in result)
              expect(result.json,).toEqual([1, 2,],);
            else
              throw new Error('expected PlainJson result',);
          },
        },),

        it({
          name: 'empty array with trailing comma',
          fn: async () => {
            const context = { remainingContent: '[ , ]' as StringJsonc, };
            const result = tryArrayFastPath({ value: '[ , ]' as FragmentStringJsonc,
              context, },);

            expect(result,).toBe(NO_FAST_PATH,);
          },
        },),
      ],
    },),
    //endregion tryArrayFastPath

    //region tryObjectFastPath
    describe({
      name: tryObjectFastPath.name,
      children: [
        it({
          name: 'clean object with boundary trailing comma succeeds',
          fn: async () => {
            const context = { remainingContent: '{"a": 1, "b": 2, }' as StringJsonc, };
            const result = tryObjectFastPath({
              value: '{"a": 1, "b": 2, }' as FragmentStringJsonc,
              context,
            },);

            if (typeof result === 'symbol')
              throw new Error('expected parsed result',);
            if (!('json' in result))
              throw new Error('expected PlainJson result',);

            expect(result.json,).toEqual({ a: 1, b: 2, },);
          },
        },),

        it({
          name: 'clean object without trailing comma succeeds',
          fn: async () => {
            const context = { remainingContent: '{"x": true}' as StringJsonc, };
            const result = tryObjectFastPath({
              value: '{"x": true}' as FragmentStringJsonc,
              context,
            },);

            if (typeof result === 'symbol')
              throw new Error('expected parsed result',);
            if (!('json' in result))
              throw new Error('expected PlainJson result',);

            expect(result.json,).toEqual({ x: true, },);
          },
        },),

        it({
          name: 'object with comments returns NO_FAST_PATH',
          fn: async () => {
            const context = { remainingContent: '{"a": /* c */ 1, }' as StringJsonc, };
            const result = tryObjectFastPath({
              value: '{"a": /* c */ 1, }' as FragmentStringJsonc,
              context,
            },);

            expect(result,).toBe(NO_FAST_PATH,);
          },
        },),

        it({
          name: 'empty object with trailing comma',
          fn: async () => {
            const context = { remainingContent: '{ , }' as StringJsonc, };
            const result = tryObjectFastPath({ value: '{ , }' as FragmentStringJsonc,
              context, },);

            expect(result,).toBe(NO_FAST_PATH,);
          },
        },),
      ],
    },),
    //endregion tryObjectFastPath
  ],
},);
