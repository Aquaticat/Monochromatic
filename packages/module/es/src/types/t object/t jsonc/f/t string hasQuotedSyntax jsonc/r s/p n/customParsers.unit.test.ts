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

const exported = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;
const { parseValueFromStart, } = exported;

//region parseValueFromStart
await describe({
  name: 'parseValueFromStart',
  children: [
    it({
      name: 'string and number',
      fn: async () => {
        const s = parseValueFromStart({ value: '"x"TAIL' as FragmentStringJsonc, },);
        expect((s.parsed as Jsonc.String).value,).toBe('"x"',);
        expect(parseValueFromStart({ value: '1, 2' as FragmentStringJsonc, },).parsed,)
          .toEqual({
            value: 1,
          },);
      },
    },),

    it({
      name: 'array dispatch',
      fn: async () => {
        const out = parseValueFromStart({ value: '[1]TAIL' as FragmentStringJsonc, },);
        const arr = out.parsed as Jsonc.Array;
        expect(arr.value[0],).toEqual({ value: 1, },);
        expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
      },
    },),
  ],
},);
//endregion parseValueFromStart
