import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const exported = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;

//region parseLiteralToken
describe('parseLiteralToken', () => {
  const $ = exported.parseLiteralToken;
  test('null/true/false', ({ expect, },) => {
    {
      const out = $({ value: 'null,' as FragmentStringJsonc, },);
      if (typeof out === 'symbol')
        throw new Error('expected literal',);
      expect(out.parsed,).toEqual({ value: null, },);
    }
    {
      const out = $({ value: 'true ]' as FragmentStringJsonc, },);
      if (typeof out === 'symbol')
        throw new Error('expected literal',);
      expect(out.parsed,).toEqual({ value: true, },);
    }
    {
      const out = $({ value: 'false]' as FragmentStringJsonc, },);
      if (typeof out === 'symbol')
        throw new Error('expected literal',);
      expect(out.parsed,).toEqual({ value: false, },);
    }
  });
  test('prefix match stays here; boundary enforced later', ({ expect, },) => {
    const out = $({ value: 'nully' as FragmentStringJsonc, },);
    if (typeof out === 'symbol')
      throw new Error('expected literal',);
    expect(out.consumed,).toBe('null',);
    expect(out.remaining,).toBe('y',);
  });
  test('returns sentinel when no literal at start', ({ expect, },) => {
    const out = $({ value: '[1]' as FragmentStringJsonc, },);
    expect(out,).toBe(exported.NO_LITERAL,);
  });
});
//endregion parseLiteralToken

//region parseNumberToken
describe('parseNumberToken', () => {
  const $ = exported.parseNumberToken;
  test('ints/decimals/exponents', ({ expect, },) => {
    expect($({ value: '0, x' as FragmentStringJsonc, },).parsed,).toEqual({
      value: 0,
    },);
    expect($({ value: '-12.3 ]' as FragmentStringJsonc, },).parsed,).toEqual({
      value: -12.3,
    },);
    expect($({ value: '6.02e23,' as FragmentStringJsonc, },).parsed,).toEqual({
      value: 6.02e23,
    },);
  });
});
//endregion parseNumberToken
