/**
 * Tests for the canonical serializer: empty containers, round-trip idempotency,
 * raw scalar preservation, and comment placement.
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
  emitJsoncValue,
  jsoncStringify,
  parseJsonc,
  parseJsoncEdit,
} from './index.ts';

const asJsonc = (source: string,): StringJsonc => source as StringJsonc;

const roundTrip = (source: string,): string =>
  jsoncStringify({ state: parseJsoncEdit({ source: asJsonc(source,), },), },);

await describe({
  name: jsoncStringify.name,
  children: [
    describe({
      name: 'idempotency',
      children: [
        it({
          name: 'a second round-trip equals the first',
          fn: async () => {
            const samples = [
              '{"a":1,"b":[1,2,3]}',
              '{\n  "a": 1, // note\n  "b": true /* blk */\n}',
              '{\n  //region cfg\n  "x": 1,\n}',
              '{ /*k*/ "a": { "b": [1, 2,] } }',
              '[]',
              '{}',
            ];
            for (const sample of samples) {
              const once = roundTrip(sample,);
              const twice = jsoncStringify({ state: parseJsoncEdit({ source: once as StringJsonc, },), },);
              expect(twice,).toBe(once,);
            }
          },
        },),
      ],
    },),
    describe({
      name: 'fidelity',
      children: [
        it({
          name: 'empty object and array stay compact',
          fn: async () => {
            expect(roundTrip('{}',),).toBe('{}',);
            expect(roundTrip('[]',),).toBe('[]',);
          },
        },),
        it({
          name: 'raw scalar token is preserved for an unedited value',
          fn: async () => {
            expect(roundTrip('{\n  "a": 1.0, // c\n}',),).toContain('1.0',);
          },
        },),
        it({
          name: 'single-line value comment emits as a trailing comment',
          fn: async () => {
            expect(roundTrip('{\n  "a": 1 // n\n}',),).toContain(': 1, // n',);
          },
        },),
        it({
          name: 'block comment is kept as a block when its body has no close delimiter',
          fn: async () => {
            expect(roundTrip('{\n  /* k */\n  "a": 1\n}',),).toContain('/* k */',);
          },
        },),
      ],
    },),
    describe({
      name: 'value emit',
      children: [
        it({
          name: 'emitJsoncValue serializes a fast-path leaf as canonical JSON',
          fn: async () => {
            expect(emitJsoncValue({ value: parseJsonc({ source: asJsonc('[1,2,3]',), },), },),).toBe(
              '[\n  1,\n  2,\n  3\n]',
            );
          },
        },),
      ],
    },),
    describe({
      name: 'exact canonical layout',
      children: [
        it({
          name: 'emits a record with indented, comma-terminated, newline-joined entries',
          fn: async () => {
            expect(roundTrip('{ "a": 1, "b": 2 } // doc',),).toBe('// doc\n{\n  "a": 1,\n  "b": 2,\n}',);
          },
        },),
        it({
          name: 'emits array elements with their trailing comments, one per line',
          fn: async () => {
            expect(roundTrip('[\n  1, // one\n  2 // two\n]',),).toBe('[\n  1, // one\n  2, // two\n]',);
          },
        },),
        it({
          name: 'emits a merged stacked key comment as indented leading line comments',
          fn: async () => {
            expect(roundTrip('{\n  // l1\n  // l2\n  "x": 1\n}',),).toBe('{\n  // l1\n  // l2\n  "x": 1,\n}',);
          },
        },),
      ],
    },),
  ],
},);
