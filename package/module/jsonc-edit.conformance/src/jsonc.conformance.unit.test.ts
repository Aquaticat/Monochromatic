/**
 Curated JSONC conformance corpus against VS Code JSONC semantics: JSON plus
 `//` and block comments and trailing commas, but not JSON5 (no single quotes,
 unquoted keys, or hex). Valid cases parse to an expected value; invalid cases
 throw.

 The shared cases live in `fixtures/jsonc-conformance.json`, which the Rust crate
 `monochromatic-jsonc-edit` reads too, so both maintained implementations answer
 the same supported-behavior contract. A task in each package fails when the two
 copies drift.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { StringJsonc, } from '@monochromatic-dev/module-jsonc-edit/ts/brand.ts';
import {
  COMMENT_ABSENT,
  jsoncGetComment,
  jsoncGetKeyComment,
  jsoncGetValue,
  jsoncKeys,
  jsoncStringify,
  parseJsonc,
  parseJsoncEdit,
} from '@monochromatic-dev/module-jsonc-edit/ts';
import type { JsonValue, } from 'type-fest';

import fixtures from '../fixtures/jsonc-conformance.json' with { type: 'json', };

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

/**
 One shared fixture case that must parse, with the shape both implementations agree on.
 */
type SharedValidCase = {
  readonly name: string;
  readonly source: string;
  readonly rootKind: string;
  readonly members: number;
};

/**
 What:     Marks a fixture expectation of "no comment here".
 Why:      The repo models absence with a sentinel rather than a nullish value, so the JSON null the
           fixture file carries is decoded into this symbol before any assertion compares it.
 */
const FIXTURE_ABSENT: unique symbol = Symbol('shared fixture expects no comment');

/**
 What:     A fixture comment expectation after decoding: text, or the absence sentinel.
 Why:      Keeps assertions null-free while still expressing "no comment".
 */
type FixtureComment = string | typeof FIXTURE_ABSENT;

/* oxlint-disable no-restricted-syntax/no-nullish-union -- the shared fixture is an external JSON document, fixtures/jsonc-conformance.json, which spells "no comment" as null and is read identically by the Rust crate; these declarations mirror that file rather than model repo state. */
/**
 What:     The JSON shape one fixture comment field has on disk.
 Why:      Naming it once keeps the mirrored nullish form in a single scoped place.
 */
type FixtureCommentJson = string | null;

/**
 One shared fixture address expectation: `null` means "no comment here".
 */
type SharedExpectation = {
  readonly path: readonly (string | number)[];
  readonly key: FixtureCommentJson;
  readonly value: FixtureCommentJson;
};

/**
 One shared fixture case describing where comments must land.
 */
type SharedOwnershipCase = {
  readonly name: string;
  readonly source: string;
  readonly root: FixtureCommentJson;
  readonly at: readonly SharedExpectation[];
};
/* oxlint-enable no-restricted-syntax/no-nullish-union */

/**
 What:     Decode one fixture comment field into text or the absence sentinel.
 Why:      The fixture's absence spelling is JSON null; narrowing by typeof keeps this module's
           comparisons free of nullish literals while still rejecting the wrong field type.
 *
 @param value - Fixture field read from JSON.

 @returns The comment text, or FIXTURE_ABSENT when the fixture expects none.
 */
const decodeComment = (value: FixtureCommentJson,): FixtureComment => {
  if (typeof value === 'string')
    return value;
  if (value === null)
    return FIXTURE_ABSENT;
  throw new TypeError(`fixture comment expectation must be a string or null, got ${JSON.stringify(value)}`);
};

/**
 What:     Decode one comment the API returned into the same vocabulary as the fixture.
 Why:      Both sides then compare as sentinel-or-text, with no nullish value involved.
 *
 @param comment - Comment query result, which is COMMENT_ABSENT when nothing is attached.

 @returns The comment text, or FIXTURE_ABSENT when the query found none.
 */
const actualComment = (comment: { type: string; text: string } | symbol,): FixtureComment =>
  (comment === COMMENT_ABSENT)
    ? FIXTURE_ABSENT
    : (comment as { text: string }).text;

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
    describe({
      name: 'shared fixtures',
      children: [
        it({
          name: 'every shared valid source parses with the agreed root shape',
          fn: async () => {
            for (const sample of fixtures.valid as readonly SharedValidCase[]) {
              const state = parseJsoncEdit({ source: asJsonc(sample.source,), },);
              const value = jsoncGetValue({ state, path: [], },);
              const isRecord = !Array.isArray(value);
              expect(isRecord ? 'record' : 'array',).toBe(sample.rootKind,);
              const members = isRecord
                ? Object.keys(value as Record<string, unknown>,).length
                : (value as readonly unknown[]).length;
              expect(members,).toBe(sample.members,);
            }
          },
        },),
        it({
          name: 'every shared invalid source throws',
          fn: async () => {
            for (const sample of fixtures.invalid as readonly { name: string; source: string }[])
              expect(() => {
                parseJsonc({ source: asJsonc(sample.source,), },);
              },).toThrow();
          },
        },),
        it({
          name: 'shared comment ownership matches on the root, keys and values',
          fn: async () => {
            for (const sample of fixtures.commentOwnership as readonly SharedOwnershipCase[]) {
              const state = parseJsoncEdit({ source: asJsonc(sample.source,), },);
              expect(actualComment(jsoncGetComment({ state, path: [], },),),).toBe(decodeComment(sample.root,),);
              for (const expectation of sample.at) {
                const path = [...expectation.path,];
                expect(actualComment(jsoncGetComment({ state, path, },),),).toBe(decodeComment(expectation.value,),);
                const finalSegment = expectation.path.at(-1,);
                if (typeof finalSegment === 'string') {
                  expect(actualComment(jsoncGetKeyComment({ state, path, },),),).toBe(decodeComment(expectation.key,),);
                }
              }
            }
          },
        },),
        it({
          name: 'shared number spellings survive canonical output',
          fn: async () => {
            for (const sample of fixtures.numberSpelling as readonly {
              name: string;
              source: string;
              emittedContains: readonly string[];
            }[]) {
              const text = jsoncStringify({
                state: parseJsoncEdit({ source: asJsonc(sample.source,), },),
              },);
              for (const needle of sample.emittedContains)
                expect(text.includes(needle,),).toBe(true,);
            }
          },
        },),
        it({
          name: 'shared number equality expectations hold for parsed values',
          fn: async () => {
            for (const sample of fixtures.numberEquality as readonly {
              name: string;
              left: string;
              right: string;
              equal: boolean;
              exactIdentityOnly?: boolean;
            }[]) {
              // TypeScript stores IEEE 754 binary64 values, so a case that needs exact mathematical
              // identity is asserted here only through the preserved source spelling. The Rust crate
              // asserts every case through its exact number identity.
              if (sample.exactIdentityOnly === true)
                continue;
              const state = parseJsoncEdit({
                source: asJsonc(`{"l":${sample.left},"r":${sample.right}}`,),
              },);
              const left = jsoncGetValue({ state, path: ['l',], },);
              const right = jsoncGetValue({ state, path: ['r',], },);
              expect(Object.is(left, right,) || (left === right),).toBe(sample.equal,);
            }
          },
        },),
        it({
          name: 'the shared nesting boundary accepts and rejects the fixture depths',
          fn: async () => {
            const { accepted, rejected, } = fixtures.depth;
            expect(rejected,).toBe(accepted + 1,);
            const nest = (depth: number,): string => `${'['.repeat(depth,)}0${']'.repeat(depth,)}`;
            expect(parseJsonc({ source: asJsonc(nest(accepted,),), },).kind,).toBe('array',);
            expect(() => {
              parseJsonc({ source: asJsonc(nest(rejected,),), },);
            },).toThrow('nesting too deep',);
          },
        },),
      ],
    },),
  ],
},);
