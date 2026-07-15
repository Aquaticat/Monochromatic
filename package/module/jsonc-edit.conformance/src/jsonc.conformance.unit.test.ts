/**
 * Curated JSONC conformance corpus against VS Code JSONC semantics: JSON plus
 * `//` and block comments and trailing commas, but not JSON5 (no single quotes,
 * unquoted keys, or hex). Valid cases parse to an expected value; invalid cases
 * throw.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { StringJsonc, } from '@monochromatic-dev/module-jsonc-edit/ts/brand.ts';
import {
  jsoncGetValue,
  parseJsonc,
  parseJsoncEdit,
} from '@monochromatic-dev/module-jsonc-edit/ts';
import type { JsonValue, } from 'type-fest';

const asJsonc = (source: string,): StringJsonc => source as StringJsonc;

type ValidCase = {
  readonly input: string;
  readonly value: JsonValue;
};

const validCases: readonly ValidCase[] = [
  { input: '{}', value: {}, },
  { input: '[]', value: [], },
  { input: '{ "a": 1, }', value: { a: 1, }, },
  { input: '[1, 2, 3,]', value: [1, 2, 3,], },
  { input: '{ "a": 1 } // trailing line comment', value: { a: 1, }, },
  { input: '// leading line comment\n{ "a": 1 }', value: { a: 1, }, },
  { input: '{ /* block */ "a": 1 }', value: { a: 1, }, },
  { input: '{\n  "a": 1, // inline\n  "b": 2\n}', value: { a: 1, b: 2, }, },
  {
    input: '{ "n": -1.5e3, "s": "x\\u0041", "b": true, "z": null }',
    value: {
      n: -1_500,
      s: 'xA',
      b: true,
      z: null,
    },
  },
  {
    input: '{ "nested": { "deep": [true, false, null] } }',
    value: { nested: { deep: [true, false, null,], }, },
  },
];

const invalidCases: readonly string[] = [
  '{ \'a\': 1 }',
  '{ a: 1 }',
  '42',
  '"bare string"',
  '{ "a": 1 ',
  '{ "a": 1 "b": 2 }',
  '{ "a": }',
  '[1 2]',
  '{ "a": 0x1F }',
  '{ "a": 1, , }',
  '{ /* open comment\n"a": 1 }',
];

await describe({
  name: 'JSONC conformance',
  children: [
    it({
      name: 'valid JSONC documents parse to the expected value',
      fn: async () => {
        for (const sample of validCases) {
          const got = jsoncGetValue({
            state: parseJsoncEdit({ source: asJsonc(sample.input,), },),
            path: [],
          },);
          expect(got,).toEqual(sample.value,);
        }
      },
    },),
    it({
      name: 'invalid or JSON5-only documents throw',
      fn: async () => {
        for (const source of invalidCases)
          expect(() => {
            parseJsonc({ source: asJsonc(source,), },);
          },).toThrow();
      },
    },),
  ],
},);
