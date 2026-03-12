import {
  describe,
  expect,
  test,
} from 'bun:test';

import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import { types, } from '@monochromatic-dev/module-es';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.scanQuotedString;

describe($, () => {
  test('basic string consumption with remaining tail', () => {
    const input = '"x"TAIL' as FragmentStringJsonc;
    const out = $({ value: input, },);
    expect(out.consumed,).toBe('"x"' as FragmentStringJsonc,);
    expect(out.parsed.value,).toBe('"x"',);
    expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
  });

  test('escaped quote inside string (odd backslash run escapes)', () => {
    const input = '"a \\" b"TAIL' as FragmentStringJsonc; // a \" b
    const out = $({ value: input, },);
    expect(out.consumed,).toBe('"a \\" b"' as FragmentStringJsonc,);
    expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
  });

  test('even backslash run before quote closes the string', () => {
    const input = (`"a ${'\\'.repeat(2,)}"TAIL`) as FragmentStringJsonc; // a \\" closes
    const out = $({ value: input, },);
    expect(out.consumed.endsWith('"',),).toBe(true,);
    expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
  });

  test('odd backslash run before quote escapes; later quote terminates', () => {
    const input = (`"a ${'\\'.repeat(3,)}\" more"TAIL`) as FragmentStringJsonc; // a \\\" more"
    const out = $({ value: input, },);
    expect(out.consumed,).toBe(`"a ${'\\'.repeat(3,)}\" more"` as FragmentStringJsonc,);
    expect(out.remaining,).toBe('TAIL' as FragmentStringJsonc,);
  });

  test('unicode and common escapes inside string', () => {
    const input = '"\\u0041\\n\\t"END' as FragmentStringJsonc; // "\u0041\n\t"
    const out = $({ value: input, },);
    expect(out.consumed,).toBe('"\\u0041\\n\\t"' as FragmentStringJsonc,);
    expect(out.remaining,).toBe('END' as FragmentStringJsonc,);
  });

  test('throws on unterminated string', () => {
    const input = '"abc' as FragmentStringJsonc;
    expect(() => $({ value: input, },)).toThrow(/malformed jsonc, unterminated string/,);
  });

  test('throws when input does not start with a quote', () => {
    const input = 'abc' as FragmentStringJsonc;
    expect(() => $({ value: input, },)).toThrow(
      /expected a double quote to start a JSON string/,
    );
  });
},);
