/**
 * Tests for JSON narrowing guards shared by protocol parsing and
 * model-content validation.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';

await describe({
  name: '',
  children: [
    describe({
      name: isJsonRecord.name,
      children: [
        it({
          name: 'admits plain records',
          fn: async () => {
            expect(isJsonRecord({ cat: '喵', },),).toBe(true,);
          },
        },),
        it({
          name: 'admits arrays, whose numeric-keyed probes simply miss',
          fn: async () => {
            expect(isJsonRecord(['喵',],),).toBe(true,);
          },
        },),
        it({
          name: 'rejects null despite its object typeof',
          fn: async () => {
            expect(isJsonRecord(null,),).toBe(false,);
          },
        },),
        it({
          name: 'rejects primitives',
          fn: async () => {
            expect(isJsonRecord('喵',),).toBe(false,);
            expect(isJsonRecord(1,),).toBe(false,);
            expect(isJsonRecord(undefined,),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: isJsonArray.name,
      children: [
        it({
          name: 'admits arrays',
          fn: async () => {
            expect(isJsonArray(['喵',],),).toBe(true,);
          },
        },),
        it({
          name: 'rejects records, null, and primitives',
          fn: async () => {
            expect(isJsonArray({ cat: '喵', },),).toBe(false,);
            expect(isJsonArray(null,),).toBe(false,);
            expect(isJsonArray('喵',),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
