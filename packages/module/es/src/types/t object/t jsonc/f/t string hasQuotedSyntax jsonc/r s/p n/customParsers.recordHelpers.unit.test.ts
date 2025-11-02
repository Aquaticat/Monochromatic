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
