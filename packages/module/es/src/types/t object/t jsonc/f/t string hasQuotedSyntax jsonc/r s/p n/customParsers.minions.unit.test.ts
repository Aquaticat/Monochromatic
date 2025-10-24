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

  //region parseRecordHeader
  describe('parseRecordHeader', () => {
    const $ = exported.parseRecordHeader;
    test('no context comment', ({ expect, },) => {
      const out = $(' "a":1}TAIL' as FragmentStringJsonc,);
      expect(out.recordComment,).toBeUndefined();
      expect(out.tail,).toBe(' "a":1}TAIL',);
    });
    test('with context comment', ({ expect, },) => {
      const out = $(
        ' "a":1}' as FragmentStringJsonc,
        { comment: { type: 'block', commentValue: 'RC', }, } as Jsonc.ValueBase,
      );
      expect(out.recordComment?.type,).toBe('block',);
      expect(out.recordComment?.commentValue,).toBe('RC',);
    });
  });
  //endregion parseRecordHeader

  //region expectRecordSeparatorOrEnd
  describe('expectRecordSeparatorOrEnd', () => {
    const $ = exported.expectRecordSeparatorOrEnd;
    test('end directly', ({ expect, },) => {
      const out = $('}TAIL' as FragmentStringJsonc,);
      if (out.kind !== 'end')
        throw new Error('expected end',);
      expect(out.tail,).toBe('TAIL',);
    });
    test('trailing comma then end', ({ expect, },) => {
      const out = $(', /* c */ }TAIL' as FragmentStringJsonc,);
      if (out.kind !== 'end')
        throw new Error('expected end',);
      expect(out.tail,).toBe('TAIL',);
    });
    test('next member start', ({ expect, },) => {
      const out = $(', /* c */ "b": 2' as FragmentStringJsonc,);
      if (out.kind !== 'next')
        throw new Error('expected next',);
      expect(out.tailStart.startsWith('"b"',),).toBe(true,);
    });
  });
  //endregion expectRecordSeparatorOrEnd

  //region parseRecordKey
  describe('parseRecordKey', () => {
    const $ = exported.parseRecordKey;
    test('simple key without comment', ({ expect, },) => {
      const out = $('"myKey": 1' as FragmentStringJsonc,);
      expect(out.keyNode.value,).toBe('"myKey"',);
      expect(out.keyNode.comment,).toBeUndefined();
      expect(out.remaining,).toBe(': 1',);
    });
    test('key with leading comment', ({ expect, },) => {
      const out = $('/* key comment */ "x": true' as FragmentStringJsonc,);
      expect(out.keyNode.value,).toBe('"x"',);
      expect(out.keyNode.comment?.type,).toBe('block',);
      expect(out.keyNode.comment?.commentValue.trim(),).toBe('key comment',);
    });
    test('error on non-quoted key', ({ expect, },) => {
      expect(() => $('unquoted: 1' as FragmentStringJsonc,)).toThrow(/expected quoted key/,);
    });
  });
  //endregion parseRecordKey

  //region expectColonAfterKey
  describe('expectColonAfterKey', () => {
    const $ = exported.expectColonAfterKey;
    test('colon immediately after', ({ expect, },) => {
      const out = $(': 1' as FragmentStringJsonc,);
      expect(out,).toBe(' 1',);
    });
    test('colon with surrounding whitespace/comments', ({ expect, },) => {
      const out = $(' /* c */ : 1' as FragmentStringJsonc,);
      expect(out,).toBe(' 1',);
    });
    test('error when colon missing', ({ expect, },) => {
      expect(() => $(' 1' as FragmentStringJsonc,)).toThrow(/expected ':' after key/,);
    });
  });
  //endregion expectColonAfterKey

  //region parseRecordValue
  describe('parseRecordValue', () => {
    const $ = exported.parseRecordValue;
    test('simple number value', ({ expect, },) => {
      const out = $(' 42, "b"' as FragmentStringJsonc,);
      expect((out.valueNode as Jsonc.Number).value,).toBe(42,);
      expect(out.remaining,).toBe(', "b"',);
    });
    test('value with leading comment', ({ expect, },) => {
      const out = $(' /* val comment */ "text"}' as FragmentStringJsonc,);
      expect((out.valueNode as Jsonc.String).value,).toBe('"text"',);
      expect(out.valueNode.comment?.type,).toBe('block',);
    });
  });
  //endregion parseRecordValue

  //region parseOneRecordMember
  describe('parseOneRecordMember', () => {
    const $ = exported.parseOneRecordMember;
    test('simple key:value pair', ({ expect, },) => {
      const out = $('"a": 1, "b"' as FragmentStringJsonc,);
      const [key, val,] = out.entry;
      expect(key.value,).toBe('"a"',);
      expect((val as Jsonc.Number).value,).toBe(1,);
      expect(out.remaining,).toBe(', "b"',);
    });
    test('with comments on key and value', ({ expect, },) => {
      const out = $('/* k */ "x": /* v */ 99}' as FragmentStringJsonc,);
      const [key, val,] = out.entry;
      expect(key.comment?.commentValue.trim(),).toBe('k',);
      expect((val as Jsonc.Number).value,).toBe(99,);
      expect(val.comment?.commentValue.trim(),).toBe('v',);
    });
  });
  //endregion parseOneRecordMember

  //region parseRecordMembers
  describe('parseRecordMembers', () => {
    const $ = exported.parseRecordMembers;
    test('single member then end', ({ expect, },) => {
      const out = $('"a": 1}TAIL' as FragmentStringJsonc,);
      expect(out.entries,).toHaveLength(1,);
      const [key, val,] = out.entries[0] as [Jsonc.RecordKey, Jsonc.Number,];
      expect(key.value,).toBe('"a"',);
      expect(val.value,).toBe(1,);
      expect(out.tail,).toBe('TAIL',);
    });
    test('multiple members with trailing comma', ({ expect, },) => {
      const out = $('"a": 1, /* c */ "b": 2, }X' as FragmentStringJsonc,);
      expect(out.entries,).toHaveLength(2,);
      expect(out.entries.map(([k, v,],) =>
        [k.value, (v as Jsonc.Number).value,]),).toEqual([['"a"', 1,], ['"b"', 2,],],);
      expect(out.tail,).toBe('X',);
    });
    test('immediate closing brace', ({ expect, },) => {
      const out = $('}TAIL' as FragmentStringJsonc,);
      expect(out.entries,).toHaveLength(0,);
      expect(out.tail,).toBe('TAIL',);
    });
  });
  //endregion parseRecordMembers
});
