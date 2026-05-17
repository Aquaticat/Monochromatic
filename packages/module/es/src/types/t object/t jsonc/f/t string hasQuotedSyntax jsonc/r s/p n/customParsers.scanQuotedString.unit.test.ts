import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import { types, } from '@monochromatic-dev/module-es';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.scanQuotedString;

await describe({
  name: $.name,
  children: [
    it({
      name: 'basic string consumption with remaining tail',
      fn: async () => {
        const input = '"x"TAIL' as FragmentStringJsonc;
        const out = $({ value: input, },);
        expect(out.consumed,).toBe('"x"' as FragmentStringJsonc,);
        expect(out.parsed.value,).toBe('"x"',);
        expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
      },
    },),

    it({
      name: 'escaped quote inside string (odd backslash run escapes)',
      fn: async () => {
        const input = String.raw`"a \" b"TAIL` as FragmentStringJsonc; // a \" b
        const out = $({ value: input, },);
        expect(out.consumed,).toBe(String.raw`"a \" b"` as FragmentStringJsonc,);
        expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
      },
    },),

    it({
      name: 'even backslash run before quote closes the string',
      fn: async () => {
        const input = (`"a ${'\\'.repeat(2,)}"TAIL`) as FragmentStringJsonc; // a \\" closes
        const out = $({ value: input, },);
        expect(out.consumed.endsWith('"',),).toBe(true,);
        expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
      },
    },),

    it({
      name: 'odd backslash run before quote escapes; later quote terminates',
      fn: async () => {
        const input = (`"a ${'\\'.repeat(3,)}" more"TAIL`) as FragmentStringJsonc; // a \\\" more"
        const out = $({ value: input, },);
        expect(out.consumed,).toBe(
          `"a ${'\\'.repeat(3,)}" more"` as FragmentStringJsonc,
        );
        expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
      },
    },),

    it({
      name: 'unicode and common escapes inside string',
      fn: async () => {
        const input = String.raw`"\u0041\n\t"END` as FragmentStringJsonc; // "\u0041\n\t"
        const out = $({ value: input, },);
        expect(out.consumed,).toBe(String.raw`"\u0041\n\t"` as FragmentStringJsonc,);
        expect(out.remaining,).toBe('END' as FragmentStringJsonc,);
      },
    },),

    it({
      name: 'throws on unterminated string',
      fn: async () => {
        const input = '"abc' as FragmentStringJsonc;
        expect(() => $({ value: input, },)).toThrow(
          'malformed jsonc, unterminated string',
        );
      },
    },),

    it({
      name: 'throws when input does not start with a quote',
      fn: async () => {
        const input = 'abc' as FragmentStringJsonc;
        expect(() => $({ value: input, },)).toThrow(
          'expected a double quote to start a JSON string',
        );
      },
    },),
  ],
},);
