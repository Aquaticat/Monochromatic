import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type * as Jsonc from '@_/types/t object/t jsonc/t/index.ts';
import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const exported = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;
const { expectArraySeparatorOrEnd, parseArrayElements, } = exported;

await describe({
  name: '',
  children: [
    //region expectArraySeparatorOrEnd
    describe({
      name: expectArraySeparatorOrEnd.name,
      children: [
        it({
          name: 'end directly',
          fn: async () => {
            const r = ']TAIL' as FragmentStringJsonc;
            const out = expectArraySeparatorOrEnd(r,);
            if (out.kind !== 'end')
              throw new Error('expected end',);
            expect(out.tail,).toBe('TAIL' as FragmentStringJsonc,);
          },
        },),

        it({
          name: 'trailing comma then end',
          fn: async () => {
            const out = expectArraySeparatorOrEnd(
              ', /* c */ ]TAIL' as FragmentStringJsonc,
            );
            if (out.kind !== 'end')
              throw new Error('expected end',);
            expect(out.tail,).toBe('TAIL' as FragmentStringJsonc,);
          },
        },),

        it({
          name: 'next element start',
          fn: async () => {
            const out = expectArraySeparatorOrEnd(
              ', /* c */ 2, x' as FragmentStringJsonc,
            );
            if (out.kind !== 'next')
              throw new Error('expected next',);
            expect(out.tailStart.startsWith('2',),).toBe(true,);
          },
        },),
      ],
    },),
    //endregion expectArraySeparatorOrEnd

    //region parseArrayElements
    describe({
      name: parseArrayElements.name,
      children: [
        it({
          name: 'single element then end',
          fn: async () => {
            const out = parseArrayElements({ tail: '1]TAIL' as FragmentStringJsonc, },);
            expect(out.items,).toEqual([{ value: 1, },],);
            expect(out.tail,).toBe('TAIL' as FragmentStringJsonc,);
          },
        },),

        it({
          name: 'multi with comments and trailing comma',
          fn: async () => {
            const out = parseArrayElements({
              tail: '1, /* c */ 2, /* d */ ]X' as FragmentStringJsonc,
            },);
            expect((out.items as Jsonc.Number[]).map(v => v.value),).toEqual([1, 2,],);
            expect(out.tail,).toBe('X' as FragmentStringJsonc,);
          },
        },),

        it({
          name: 'invalid: identifier right after literal (boundary handled by separator)',
          fn: async () => {
            expect(() => parseArrayElements({ tail: 'nullY]' as FragmentStringJsonc, },))
              .toThrow(`expected ',' or ']'`,);
          },
        },),
      ],
    },),
    //endregion parseArrayElements
  ],
},);
