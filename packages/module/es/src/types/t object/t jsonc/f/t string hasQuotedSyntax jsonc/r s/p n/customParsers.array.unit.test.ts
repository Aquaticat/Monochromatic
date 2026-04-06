import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import type * as Jsonc from '@_/types/t object/t jsonc/t/index.ts';
import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const $ =
  types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.customParserForArray;

await describe({
  name: $.name,
  children: [
    //region Empty arrays -- basic and with comments
    it({
      name: 'empty array',
      fn: async () => {
        const input = '[]' as FragmentStringJsonc;
        const out = $({ value: input, },);
        expect(out.value,).toEqual([],);
        expect(out.remainingContent,).toBe('' as FragmentStringJsonc,);
      },
    },),

    it({
      name: 'empty array with leading comment',
      fn: async () => {
        const input = '[ /* c */ ]TAIL' as FragmentStringJsonc;
        const out = $({ value: input, },);
        expect(out.value,).toEqual([],);
        expect(out.comment?.type,).toBe('block',);
        expect(out.remainingContent,).toBe('TAIL' as FragmentStringJsonc,);
      },
    },),
    //endregion Empty arrays

    //region Primitives and separators -- single/multiple numbers and trailing comma
    it({
      name: 'single primitive number',
      fn: async () => {
        const out = $({ value: '[1]' as FragmentStringJsonc, },);
        expect(Array.isArray(out.value,),).toBe(true,);
        expect(out.value[0],).toEqual({ value: 1, },);
        expect(out.remainingContent,).toBe('' as FragmentStringJsonc,);
      },
    },),

    it({
      name: 'multiple numbers',
      fn: async () => {
        const out = $({ value: '[1, 2, 3]' as FragmentStringJsonc, },);
        expect((out.value as Jsonc.Number[]).map(v => v.value),).toEqual([1, 2, 3,],);
      },
    },),

    it({
      name: 'trailing comma with comments',
      fn: async () => {
        const out = $({ value: '[1, /* c */ 2, /* d */ ]X' as FragmentStringJsonc, },);
        expect((out.value as Jsonc.Number[]).map(v => v.value),).toEqual([1, 2,],);
        expect(out.remainingContent,).toBe('X' as FragmentStringJsonc,);
      },
    },),
    //endregion Primitives and separators

    //region Strings and escapes -- ensure quoted parsing cooperates
    it({
      name: 'strings with escaped quote',
      fn: async () => {
        const out = $({ value: String.raw`["a\"b", "c"]` as FragmentStringJsonc, },);
        expect(out.value[0],).toHaveProperty('value',);
        expect((out.value[0] as Jsonc.String).value,).toBe(String.raw`"a\"b"`,);
        expect((out.value[1] as Jsonc.String).value,).toBe('"c"',);
      },
    },),
    //endregion Strings and escapes

    //region Nested arrays -- delegate inner arrays
    it({
      name: 'nested arrays',
      fn: async () => {
        const out = $({ value: '[[1], [2, 3]]' as FragmentStringJsonc, },);
        const arr0 = out.value[0] as Jsonc.Array;
        const arr1 = out.value[1] as Jsonc.Array;
        const inner1 = arr0.value;
        const inner2 = arr1.value as Jsonc.Number[];
        expect(inner1[0],).toEqual({ value: 1, },);
        expect(inner2.map(v => v.value),).toEqual([2, 3,],);
      },
    },),
    //endregion Nested arrays

    //region Errors -- malformed separators
    it({
      name: 'missing comma between elements',
      fn: async () => {
        expect(() => $({ value: '[1 2]' as FragmentStringJsonc, },)).toThrow(
          /expected ',' or ']'/,
        );
      },
    },),

    it({
      name: 'dangling comma without closing bracket',
      fn: async () => {
        expect(() => $({ value: '[1, 2,' as FragmentStringJsonc, },)).toThrow();
      },
    },),
    //endregion Errors

    //region Array-level vs first-item comments -- semantics for outside/inside comments
    it({
      name: 'array-level comment comes from outside (context)',
      fn: async () => {
        const out = $({
          value: '[1]' as FragmentStringJsonc,
          // Represent outside comment before '[' via context
          context: { comment: { type: 'block', commentValue: 'A', }, } as Jsonc.ValueBase,
        },);
        expect(out.comment?.type,).toBe('block',);
        expect(out.comment?.commentValue,).toBe('A',);
        expect((out.value[0] as Jsonc.Value).comment,).toBeUndefined();
      },
    },),

    it({
      name: 'first element receives inside comment (non-empty array)',
      fn: async () => {
        const out = $({ value: '[ /* C */ 1 ]' as FragmentStringJsonc, },);
        expect(out.comment,).toBeUndefined();
        expect((out.value[0] as Jsonc.Value).comment?.type,).toBe('block',);
        expect((out.value[0] as Jsonc.Value).comment?.commentValue.trim(),).toBe('C',);
      },
    },),

    it({
      name: 'both outside (array) and inside (first item) comments preserved',
      fn: async () => {
        const out = $({
          value: '[ /* C */ 1 ]' as FragmentStringJsonc,
          context: { comment: { type: 'block', commentValue: 'A', }, } as Jsonc.ValueBase,
        },);
        expect(out.comment?.commentValue,).toBe('A',);
        expect((out.value[0] as Jsonc.Value).comment?.commentValue.trim(),).toBe('C',);
      },
    },),

    it({
      name: 'empty array merges inside comment into array-level',
      fn: async () => {
        const out = $({ value: '[ /* X */ ]TAIL' as FragmentStringJsonc, },);
        expect(out.value,).toEqual([],);
        expect(out.comment?.type,).toBe('block',);
        expect(out.comment?.commentValue.trim(),).toBe('X',);
        expect(out.remainingContent,).toBe('TAIL' as FragmentStringJsonc,);
      },
    },),

    it({
      name: 'empty array merges outside and inside comments',
      fn: async () => {
        const out = $({
          value: '[ /* X */ ]TAIL' as FragmentStringJsonc,
          context: { comment: { type: 'block', commentValue: 'A', }, } as Jsonc.ValueBase,
        },);
        expect(out.value,).toEqual([],);
        expect(out.comment?.type,).toBe('block',);
        expect(out.comment?.commentValue,).toBe('A\n X ',);
        expect(out.remainingContent,).toBe('TAIL' as FragmentStringJsonc,);
      },
    },),
    //endregion Array-level vs first-item comments
  ],
},);
