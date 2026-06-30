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

import type { StringJsonc, } from './brand.ts';
import {
  COMMENT_ABSENT,
  jsoncGetComment,
  jsoncGetKeyComment,
  jsoncGetValue,
  parseJsonc,
  parseJsoncEdit,
} from './index.ts';

const asJsonc = (source: string,): StringJsonc => source as StringJsonc;

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
  ],
},);
