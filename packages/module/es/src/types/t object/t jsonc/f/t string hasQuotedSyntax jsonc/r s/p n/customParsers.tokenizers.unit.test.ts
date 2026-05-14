import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const exported = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;
const { parseLiteralToken, parseNumberToken, NO_LITERAL, } = exported;

await describe({
  name: '',
  children: [
    //region parseLiteralToken
    describe({
      name: parseLiteralToken.name,
      children: [
        it({
          name: 'null/true/false',
          fn: async () => {
            {
              const out = parseLiteralToken({ value: 'null,' as FragmentStringJsonc, },);
              if ((typeof out) === 'symbol')
                throw new Error('expected literal',);
              expect(out.parsed,).toEqual({ value: null, },);
            }
            {
              const out = parseLiteralToken({ value: 'true ]' as FragmentStringJsonc, },);
              if ((typeof out) === 'symbol')
                throw new Error('expected literal',);
              expect(out.parsed,).toEqual({ value: true, },);
            }
            {
              const out = parseLiteralToken({ value: 'false]' as FragmentStringJsonc, },);
              if ((typeof out) === 'symbol')
                throw new Error('expected literal',);
              expect(out.parsed,).toEqual({ value: false, },);
            }
          },
        },),

        it({
          name: 'prefix match stays here; boundary enforced later',
          fn: async () => {
            const out = parseLiteralToken({ value: 'nully' as FragmentStringJsonc, },);
            if ((typeof out) === 'symbol')
              throw new Error('expected literal',);
            expect(out.consumed,).toBe('null' as FragmentStringJsonc,);
            expect(out.remaining,).toBe('y' as FragmentStringJsonc,);
          },
        },),

        it({
          name: 'returns sentinel when no literal at start',
          fn: async () => {
            const out = parseLiteralToken({ value: '[1]' as FragmentStringJsonc, },);
            expect(out,).toBe(NO_LITERAL,);
          },
        },),
      ],
    },),
    //endregion parseLiteralToken

    //region parseNumberToken
    describe({
      name: parseNumberToken.name,
      children: [
        it({
          name: 'ints/decimals/exponents',
          fn: async () => {
            expect(parseNumberToken({ value: '0, x' as FragmentStringJsonc, },).parsed,)
              .toEqual({
                value: 0,
              },);
            expect(
              parseNumberToken({ value: '-12.3 ]' as FragmentStringJsonc, },).parsed,
            )
              .toEqual({
                value: -12.3,
              },);
            expect(
              parseNumberToken({ value: '6.02e23,' as FragmentStringJsonc, },).parsed,
            )
              .toEqual({
                value: 6.02e23,
              },);
          },
        },),
      ],
    },),
    //endregion parseNumberToken
  ],
},);
