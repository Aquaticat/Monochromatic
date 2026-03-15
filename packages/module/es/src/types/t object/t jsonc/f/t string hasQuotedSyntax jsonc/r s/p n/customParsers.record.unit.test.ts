import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';

const $ =
  types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.customParserForRecord;

describe($, () => {
  //region Empty objects -- basic and with comments
  test('empty object', () => {
    const input = '{}' as FragmentStringJsonc;
    const out = $({ value: input, },);
    expect(out.value instanceof Map,).toBe(true,);
    expect(out.value.size,).toBe(0,);
    expect(out.remainingContent,).toBe('' as FragmentStringJsonc,);
  });

  test('empty object with inside comment merges into record-level', () => {
    const input = '{ /* c */ }TAIL' as FragmentStringJsonc;
    const out = $({ value: input, },);
    expect(out.value.size,).toBe(0,);
    expect(out.comment?.type,).toBe('block',);
    expect(out.comment?.commentValue.trim(),).toBe('c',);
    expect(out.remainingContent,).toBe('TAIL' as FragmentStringJsonc,);
  });
  //endregion Empty objects

  //region Pairs and separators -- single/multiple and trailing comma
  test('single pair', () => {
    const out = $({ value: '{"a": 1}' as FragmentStringJsonc, },);
    const entries = [...out.value.entries(),];
    expect(entries,).toHaveLength(1,);
    const [key, val,] = entries[0] as [Jsonc.RecordKey, Jsonc.Value,];
    expect(key.value,).toBe('"a"',);
    expect((val as Jsonc.Number).value,).toBe(1,);
  });

  test('multiple pairs with trailing comma and comments', () => {
    const out = $({
      value: '{"a":1, /* c */ "b": 2, /* d */ }X' as FragmentStringJsonc,
    },);
    const entries = [...out.value.entries(),];
    expect(
      entries.map((
        [k, v,]: [Jsonc.RecordKey, Jsonc.Value,],
      ) => [k.value, (v as Jsonc.Number).value,]),
    )
      .toEqual([['"a"', 1,], ['"b"', 2,],],);
    expect(out.remainingContent,).toBe('X' as FragmentStringJsonc,);
  });
  //endregion Pairs and separators

  //region Nesting -- arrays and objects
  test('nested containers', () => {
    const out = $({ value: '{"a": [1], "b": {}}' as FragmentStringJsonc, },);
    const entries = [...out.value.entries(),];
    const aEntry = entries[0];
    const bEntry = entries[1];
    if (aEntry === undefined || bEntry === undefined) throw new Error('expected 2 entries');
    const aVal = aEntry[1] as Jsonc.Array;
    const bVal = bEntry[1] as Jsonc.Record;
    expect(Array.isArray(aVal.value,),).toBe(true,);
    expect((aVal.value[0] as Jsonc.Number).value,).toBe(1,);
    expect(bVal.value instanceof Map,).toBe(true,);
    expect(bVal.value.size,).toBe(0,);
  });
  //endregion Nesting

  //region Comments semantics -- outside vs inside
  test('record-level comment from context', () => {
    const out = $({
      value: '{"a":1}' as FragmentStringJsonc,
      context: { comment: { type: 'block', commentValue: 'A', }, } as Jsonc.ValueBase,
    },);
    expect(out.comment?.commentValue,).toBe('A',);
  });

  test('first key receives inside comment', () => {
    const out = $({ value: '{ /* C */ "a": 1 }' as FragmentStringJsonc, },);
    const firstKey = [...out.value.keys(),][0] as Jsonc.RecordKey;
    expect(firstKey.comment?.type,).toBe('block',);
    expect(firstKey.comment?.commentValue.trim(),).toBe('C',);
    expect(out.comment,).toBeUndefined();
  });

  test('empty object merges outside and inside comments', () => {
    const out = $({
      value: '{ /* X */ }TAIL' as FragmentStringJsonc,
      context: { comment: { type: 'block', commentValue: 'A', }, } as Jsonc.ValueBase,
    },);
    expect(out.value.size,).toBe(0,);
    expect(out.comment?.type,).toBe('block',);
    expect(out.comment?.commentValue,).toBe('A\n X ',);
    expect(out.remainingContent,).toBe('TAIL' as FragmentStringJsonc,);
  });
  //endregion Comments semantics

  //region Errors -- malformed structures
  test('missing colon after key', () => {
    expect(() => $({ value: '{"a" 1}' as FragmentStringJsonc, },)).toThrow(
      /expected ':' after key/,
    );
  });

  test('missing comma between pairs', () => {
    expect(() => $({ value: '{"a":1 "b":2}' as FragmentStringJsonc, },)).toThrow(
      /expected ',' or '}/,
    );
  });
  //endregion Errors
},);
