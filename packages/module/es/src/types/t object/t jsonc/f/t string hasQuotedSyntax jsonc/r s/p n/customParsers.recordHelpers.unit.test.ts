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
const {
  parseRecordHeader,
  expectRecordSeparatorOrEnd,
  parseRecordKey,
  expectColonAfterKey,
  parseRecordValue,
  parseOneRecordMember,
  parseRecordMembers,
} = exported;

await describe({
  name: '',
  children: [
    //region parseRecordHeader
    describe({
      name: 'parseRecordHeader',
      children: [
        it({
          name: 'no context comment',
          fn: async () => {
            const out = parseRecordHeader(' "a":1}TAIL' as FragmentStringJsonc,);
            expect(out.recordComment,).toBeUndefined();
            expect(out.tail,).toBe(' "a":1}TAIL' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'with context comment',
          fn: async () => {
            const out = parseRecordHeader(
              ' "a":1}' as FragmentStringJsonc,
              { comment: { type: 'block', commentValue: 'RC', }, } as Jsonc.ValueBase,
            );
            expect(out.recordComment?.type,).toBe('block',);
            expect(out.recordComment?.commentValue,).toBe('RC',);
          },
        }),
      ],
    }),
    //endregion parseRecordHeader

    //region expectRecordSeparatorOrEnd
    describe({
      name: 'expectRecordSeparatorOrEnd',
      children: [
        it({
          name: 'end directly',
          fn: async () => {
            const out = expectRecordSeparatorOrEnd('}TAIL' as FragmentStringJsonc,);
            if (out.kind !== 'end')
              throw new Error('expected end',);
            expect(out.tail,).toBe('TAIL' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'trailing comma then end',
          fn: async () => {
            const out = expectRecordSeparatorOrEnd(', /* c */ }TAIL' as FragmentStringJsonc,);
            if (out.kind !== 'end')
              throw new Error('expected end',);
            expect(out.tail,).toBe('TAIL' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'next member start',
          fn: async () => {
            const out = expectRecordSeparatorOrEnd(', /* c */ "b": 2' as FragmentStringJsonc,);
            if (out.kind !== 'next')
              throw new Error('expected next',);
            expect(out.tailStart.startsWith('"b"',),).toBe(true,);
          },
        }),
      ],
    }),
    //endregion expectRecordSeparatorOrEnd

    //region parseRecordKey
    describe({
      name: 'parseRecordKey',
      children: [
        it({
          name: 'simple key without comment',
          fn: async () => {
            const out = parseRecordKey('"myKey": 1' as FragmentStringJsonc,);
            expect(out.keyNode.value,).toBe('"myKey"',);
            expect(out.keyNode.comment,).toBeUndefined();
            expect(out.remaining,).toBe(': 1' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'key with leading comment',
          fn: async () => {
            const out = parseRecordKey('/* key comment */ "x": true' as FragmentStringJsonc,);
            expect(out.keyNode.value,).toBe('"x"',);
            expect(out.keyNode.comment?.type,).toBe('block',);
            expect(out.keyNode.comment?.commentValue.trim(),).toBe('key comment',);
          },
        }),

        it({
          name: 'error on non-quoted key',
          fn: async () => {
            expect(() => parseRecordKey('unquoted: 1' as FragmentStringJsonc,)).toThrow(
              /expected quoted key/,
            );
          },
        }),
      ],
    }),
    //endregion parseRecordKey

    //region expectColonAfterKey
    describe({
      name: 'expectColonAfterKey',
      children: [
        it({
          name: 'colon immediately after',
          fn: async () => {
            const out = expectColonAfterKey(': 1' as FragmentStringJsonc,);
            expect(out,).toBe(' 1' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'colon with surrounding whitespace/comments',
          fn: async () => {
            const out = expectColonAfterKey(' /* c */ : 1' as FragmentStringJsonc,);
            expect(out,).toBe(' 1' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'error when colon missing',
          fn: async () => {
            expect(() => expectColonAfterKey(' 1' as FragmentStringJsonc,)).toThrow(/expected ':' after key/,);
          },
        }),
      ],
    }),
    //endregion expectColonAfterKey

    //region parseRecordValue
    describe({
      name: 'parseRecordValue',
      children: [
        it({
          name: 'simple number value',
          fn: async () => {
            const out = parseRecordValue(' 42, "b"' as FragmentStringJsonc,);
            expect((out.valueNode as Jsonc.Number).value,).toBe(42,);
            expect(out.remaining,).toBe(', "b"' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'value with leading comment',
          fn: async () => {
            const out = parseRecordValue(' /* val comment */ "text"}' as FragmentStringJsonc,);
            expect((out.valueNode as Jsonc.String).value,).toBe('"text"',);
            expect(out.valueNode.comment?.type,).toBe('block',);
          },
        }),
      ],
    }),
    //endregion parseRecordValue

    //region parseOneRecordMember
    describe({
      name: 'parseOneRecordMember',
      children: [
        it({
          name: 'simple key:value pair',
          fn: async () => {
            const out = parseOneRecordMember('"a": 1, "b"' as FragmentStringJsonc,);
            const [key, val,] = out.entry;
            expect(key.value,).toBe('"a"',);
            expect((val as Jsonc.Number).value,).toBe(1,);
            expect(out.remaining,).toBe(', "b"' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'with comments on key and value',
          fn: async () => {
            const out = parseOneRecordMember('/* k */ "x": /* v */ 99}' as FragmentStringJsonc,);
            const [key, val,] = out.entry;
            expect(key.comment?.commentValue.trim(),).toBe('k',);
            expect((val as Jsonc.Number).value,).toBe(99,);
            expect(val.comment?.commentValue.trim(),).toBe('v',);
          },
        }),
      ],
    }),
    //endregion parseOneRecordMember

    //region parseRecordMembers
    describe({
      name: 'parseRecordMembers',
      children: [
        it({
          name: 'single member then end',
          fn: async () => {
            const out = parseRecordMembers('"a": 1}TAIL' as FragmentStringJsonc,);
            expect(out.entries,).toHaveLength(1,);
            const [key, val,] = out.entries[0] as [Jsonc.RecordKey, Jsonc.Number,];
            expect(key.value,).toBe('"a"',);
            expect(val.value,).toBe(1,);
            expect(out.tail,).toBe('TAIL' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'multiple members with trailing comma',
          fn: async () => {
            const out = parseRecordMembers('"a": 1, /* c */ "b": 2, }X' as FragmentStringJsonc,);
            expect(out.entries,).toHaveLength(2,);
            expect(out.entries.map(([k, v,],) => [k.value, (v as Jsonc.Number).value,]),).toEqual(
              [['"a"', 1,], ['"b"', 2,],],
            );
            expect(out.tail,).toBe('X' as FragmentStringJsonc,);
          },
        }),

        it({
          name: 'immediate closing brace',
          fn: async () => {
            const out = parseRecordMembers('}TAIL' as FragmentStringJsonc,);
            expect(out.entries,).toHaveLength(0,);
            expect(out.tail,).toBe('TAIL' as FragmentStringJsonc,);
          },
        }),
      ],
    }),
    //endregion parseRecordMembers
  ],
},);
