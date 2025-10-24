import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

import type * as Jsonc from '@_/types/t object/t jsonc/t/index.ts';
import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const exported = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named;

describe('minion helpers', () => {
  //region parseLiteralToken
  describe('parseLiteralToken', () => {
    const $ = exported.parseLiteralToken;
    test('null/true/false', ({ expect, },) => {
      {
        const out = $({ value: 'null,' as FragmentStringJsonc, },);
        // TODO: Add the fact that "ts can't narrow down union by a unique symbol, only by typeof symbol" to AI instruction files.
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

  //region parseValueFromStart
  describe('parseValueFromStart', () => {
    const $ = exported.parseValueFromStart;
    test('string and number', ({ expect, },) => {
      const s = $({ value: '"x"TAIL' as FragmentStringJsonc, },);
      expect((s.parsed as Jsonc.String).value,).toBe('"x"',);
      expect($({ value: '1, 2' as FragmentStringJsonc, },).parsed,).toEqual({
        value: 1,
      },);
    });
    test('array dispatch', ({ expect, },) => {
      const out = $({ value: '[1]TAIL' as FragmentStringJsonc, },);
      const arr = out.parsed as Jsonc.Array;
      expect(arr.value[0],).toEqual({ value: 1, },);
      expect(out.remaining,).toBe('TAIL',);
    });
  });
  //endregion parseValueFromStart

  //region expectArraySeparatorOrEnd
  describe('expectArraySeparatorOrEnd', () => {
    const $ = exported.expectArraySeparatorOrEnd;
    test('end directly', ({ expect, },) => {
      const r = ']TAIL' as FragmentStringJsonc;
      const out = $(r,);
      if (out.kind !== 'end')
        throw new Error('expected end',);
      expect(out.tail,).toBe('TAIL',);
    });
    test('trailing comma then end', ({ expect, },) => {
      const out = $(', /* c */ ]TAIL' as FragmentStringJsonc,);
      if (out.kind !== 'end')
        throw new Error('expected end',);
      expect(out.tail,).toBe('TAIL',);
    });
    test('next element start', ({ expect, },) => {
      const out = $(', /* c */ 2, x' as FragmentStringJsonc,);
      if (out.kind !== 'next')
        throw new Error('expected next',);
      expect(out.tailStart.startsWith('2',),).toBe(true,);
    });
  });
  //endregion expectArraySeparatorOrEnd

  //region parseArrayElements
  describe('parseArrayElements', () => {
    const $ = exported.parseArrayElements;
    test('single element then end', ({ expect, },) => {
      const out = $('1]TAIL' as FragmentStringJsonc,);
      expect(out.items,).toEqual([{ value: 1, },],);
      expect(out.tail,).toBe('TAIL',);
    });
    test('multi with comments and trailing comma', ({ expect, },) => {
      const out = $('1, /* c */ 2, /* d */ ]X' as FragmentStringJsonc,);
      expect((out.items as Jsonc.Number[]).map(v => v.value),).toEqual([1, 2,],);
      expect(out.tail,).toBe('X',);
    });
    test('invalid: identifier right after literal (boundary handled by separator)', ({ expect, },) => {
      expect(() => $('nullY]' as FragmentStringJsonc,)).toThrow(/expected ',' or ']'/,);
    });
  });
  //endregion parseArrayElements
});
