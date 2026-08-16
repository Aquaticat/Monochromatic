/**
 * Tests for the JSONC parser: the fast-path, comment attachment to keys and
 * values, merged stacked comments, trailing-comma tolerance, and error cases.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type StringJsonc,
  COMMENT_ABSENT,
  jsoncGetComment,
  jsoncGetKeyComment,
  jsoncGetValue,
  parseJsonc,
  parseJsoncEdit,
} from '../dist/final/neutral/index.mjs';

const asJsonc = (source: string,): StringJsonc => source as StringJsonc;

const nestArrays = (depth: number,): string => `${'['.repeat(depth,)}${']'.repeat(depth,)} // x`;

const nestObjects = (depth: number,): string => `${'{"a":'.repeat(depth,)}1${'}'.repeat(depth,)} // x`;

await describe({
  name: parseJsonc.name,
  children: [
    describe({
      name: 'fast-path',
      children: [
        it({
          name: 'clean object parses to a plainJson leaf',
          fn: async () => {
            const result = parseJsonc({ source: asJsonc('{"a":1,"b":[1,2,3]}',), },);
            expect(result.kind,).toBe('plainJson',);
            if (result.kind === 'plainJson')
              expect(result.json,).toEqual({ a: 1, b: [1, 2, 3,], },);
          },
        },),
        it({
          name: 'clean array parses to a plainJson leaf',
          fn: async () => {
            expect(parseJsonc({ source: asJsonc('[1,2,3]',), },).kind,).toBe('plainJson',);
          },
        },),
      ],
    },),
    describe({
      name: 'comments',
      children: [
        it({
          name: 'trailing inline comment attaches to the value',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('{\n  "a": 1 // note\n}',), },);
            expect(jsoncGetComment({ state, path: ['a',], },),).toEqual({ type: 'inline', text: ' note', },);
          },
        },),
        it({
          name: 'block comment attaches to the value',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('{\n  "a": 1 /* blk */\n}',), },);
            expect(jsoncGetComment({ state, path: ['a',], },),).toEqual({ type: 'block', text: ' blk ', },);
          },
        },),
        it({
          name: 'leading comment before a key attaches to the key',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('{\n  // server\n  "a": 1\n}',), },);
            expect(jsoncGetKeyComment({ state, path: ['a',], },),).toEqual({ type: 'inline', text: ' server', },);
            expect(jsoncGetComment({ state, path: ['a',], },),).toBe(COMMENT_ABSENT,);
          },
        },),
        it({
          name: 'stacked comments merge into a mixed comment',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('{\n  //region a\n  /* b */\n  "a": 1\n}',), },);
            expect(jsoncGetKeyComment({ state, path: ['a',], },),).toEqual({ type: 'mixed', text: 'region a\n b ', },);
          },
        },),
        it({
          name: 'leading document comment attaches to the root',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('// hi\n{"a":1}',), },);
            expect(jsoncGetComment({ state, path: [], },),).toEqual({ type: 'inline', text: ' hi', },);
          },
        },),
      ],
    },),
    describe({
      name: 'trailing commas',
      children: [
        it({
          name: 'object trailing comma is tolerated',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('{\n  "a": 1, // c\n}',), },);
            expect(jsoncGetValue({ state, path: ['a',], },),).toBe(1,);
          },
        },),
        it({
          name: 'array trailing comma is tolerated',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('[\n  1, // c\n  2,\n]',), },);
            expect(jsoncGetValue({ state, path: [], },),).toEqual([1, 2,],);
          },
        },),
      ],
    },),
    describe({
      name: 'errors',
      children: [
        it({
          name: 'top-level scalar throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('42',), },);
            },).toThrow('object or array',);
          },
        },),
        it({
          name: 'unterminated object throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('{ // x',), },);
            },).toThrow('unterminated object',);
          },
        },),
        it({
          name: 'trailing content after the top-level value throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('{ "a": 1 } // c\n2',), },);
            },).toThrow('trailing content',);
          },
        },),
        it({
          name: 'missing colon throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('{ "a" 1, // x\n}',), },);
            },).toThrow('expected :',);
          },
        },),
        it({
          name: 'unterminated block comment throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('{ /* open\n"a": 1 }',), },);
            },).toThrow('unterminated block comment',);
          },
        },),
      ],
    },),
    describe({
      name: 'depth guard',
      children: [
        it({
          name: 'parses arrays nested to the limit without throwing',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc(nestArrays(513,),), },);
            },).not
              .toThrow();
          },
        },),
        it({
          name: 'throws on arrays nested past the limit',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc(nestArrays(514,),), },);
            },).toThrow('nesting too deep',);
          },
        },),
        it({
          name: 'throws on objects nested past the limit',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc(nestObjects(514,),), },);
            },).toThrow('nesting too deep',);
          },
        },),
      ],
    },),
    describe({
      name: 'structural errors',
      children: [
        it({
          name: 'unterminated array throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('[',), },);
            },).toThrow('unterminated array',);
          },
        },),
        it({
          name: 'a missing comma between array elements throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('[1 2]',), },);
            },).toThrow('expected , or ]',);
          },
        },),
        it({
          name: 'a non-string object key throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('{ 1: 2 }',), },);
            },).toThrow('expected string key',);
          },
        },),
        it({
          name: 'a missing comma between object entries throws',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('{ "a": 1 "b": 2 }',), },);
            },).toThrow('expected , or }',);
          },
        },),
      ],
    },),
    describe({
      name: 'top-level shape and fast-path',
      children: [
        it({
          name: 'rejects a top-level null, boolean, and string',
          fn: async () => {
            expect(() => {
              parseJsonc({ source: asJsonc('null',), },);
            },).toThrow('object or array',);
            expect(() => {
              parseJsonc({ source: asJsonc('true',), },);
            },).toThrow('object or array',);
            expect(() => {
              parseJsonc({ source: asJsonc('"x"',), },);
            },).toThrow('object or array',);
          },
        },),
        it({
          name: 'a clean document takes the fast-path leaf',
          fn: async () => {
            expect(parseJsonc({ source: asJsonc('{"a":1}',), },).kind,).toBe('plainJson',);
          },
        },),
        it({
          name: 'a commented document uses the structured parser',
          fn: async () => {
            expect(parseJsonc({ source: asJsonc('{ "a": 1 } // c',), },).kind,).toBe('record',);
          },
        },),
      ],
    },),
    describe({
      name: 'dangling comments before close',
      children: [
        it({
          name: 'an array dangling comment folds onto the last element',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('[\n  1,\n  2,\n  // tail\n]',), },);
            expect(jsoncGetComment({ state, path: [1,], },),).toEqual({ type: 'inline', text: ' tail', },);
            expect(jsoncGetValue({ state, path: [], },),).toEqual([1, 2,],);
          },
        },),
        it({
          name: 'a record dangling comment folds onto the last value',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('{\n  "a": 1,\n  // tail\n}',), },);
            expect(jsoncGetComment({ state, path: ['a',], },),).toEqual({ type: 'inline', text: ' tail', },);
          },
        },),
        it({
          name: 'an empty array dangling comment attaches to the array node',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('[\n  // only\n]',), },);
            expect(jsoncGetComment({ state, path: [], },),).toEqual({ type: 'inline', text: ' only', },);
            expect(jsoncGetValue({ state, path: [], },),).toEqual([],);
          },
        },),
        it({
          name: 'an empty record dangling comment attaches to the record node',
          fn: async () => {
            const state = parseJsoncEdit({ source: asJsonc('{\n  // only\n}',), },);
            expect(jsoncGetComment({ state, path: [], },),).toEqual({ type: 'inline', text: ' only', },);
            expect(jsoncGetValue({ state, path: [], },),).toEqual({},);
          },
        },),
      ],
    },),
  ],
},);
