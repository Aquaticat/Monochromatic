/**
 * Parser properties for `parseTomlEdit`, the package's input boundary.
 *
 * The headline property is totality: over arbitrary text, raw bytes, near-miss
 * corruptions, the committed corpus, and pathologically deep nesting,
 * `parseTomlEdit` must either return a state or throw `TomlEditError`, never a
 * raw `ParseError`, `RangeError`, or any other unwrapped exception. The
 * deep-nesting examples are pinned: they reproduce a real bug where a stack
 * overflow in the underlying parser escaped the `ParseError`-only catch and
 * leaked a raw `RangeError` (now wrapped as `TomlEditError`).
 *
 * Also covered: every generated document parses; every committed invalid
 * fixture rejects with `TomlEditError`; and the TOML 1.0 versus 1.1 grammar
 * split (newline inside an inline table) is asserted under each dialect.
 *
 * Run plan and seed policy: see `../fuzz-budget.ts`.
 *
 * @module
 */

import {
  assert,
  asyncProperty,
  constantFrom,
  integer,
  oneof,
  string,
} from 'fast-check';

import { ParseError, } from 'toml-eslint-parser';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  parseTomlEdit,
  TomlEditError,
} from '@monochromatic-dev/module-toml-edit';

import {
  fuzzRunPlan,
  isCampaignMode,
} from '../fuzz-budget.ts';
import { documentArbitrary, } from './arb-documents.ts';
import {
  discoverRepoToml,
  loadInvalidFixtures,
  loadValidFixtures,
} from './corpus.ts';
import { corruptedDocumentArbitrary, } from './mutators.ts';

//region Setup

/**
 * Run plan resolved once for every property in this file.
 */
const RUN = fuzzRunPlan();

/**
 * Upper bound on live repository TOML files pulled into the campaign corpus.
 */
const REPO_CORPUS_LIMIT = 300;

/**
 * Maximum nesting depth for the random (non-pinned) deep-nesting arbitrary,
 * kept well below the overflow threshold so most random draws still parse.
 */
const MODERATE_NEST_MAX = 2_000;

/**
 * Array nesting depth that reproduces the stack-overflow regression.
 */
const DEEP_ARRAY_DEPTH = 20_000;

/**
 * Inline-table nesting depth that reproduces the stack-overflow regression.
 */
const DEEP_INLINE_DEPTH = 3_000;

/**
 * Committed valid fixtures plus, in campaign mode, live repository TOML.
 */
const validSources = [
  ...(await loadValidFixtures()).map(function source(entry,) { return entry.source; },),
  ...(await discoverRepoToml({
    campaign: isCampaignMode(),
    limit: REPO_CORPUS_LIMIT,
  },)).map(function source(entry,) { return entry.source; },),
];

/**
 * Committed invalid fixtures (every one rejects under the default dialect).
 */
const invalidFixtures = await loadInvalidFixtures();

/**
 * Version-split fixtures: invalid under TOML 1.0, valid under TOML 1.1.
 */
const versionSplitSources = (await loadValidFixtures())
  .filter(function isSplit(entry,) {
    return entry.name.startsWith('toml10-invalid-toml11-valid',);
  },)
  .map(function source(entry,) { return entry.source; },);

/**
 * Build a deeply nested array document of the given depth.
 *
 * @returns Source with `depth` open then close brackets under one key.
 */
function deepArrayDoc(depth: number,): string {
  return `deep = ${'['.repeat(depth,)}${']'.repeat(depth,)}\n`;
}

/**
 * Build a deeply nested inline-table document of the given depth.
 *
 * @returns Source with `depth` nested inline tables under one key.
 */
function deepInlineDoc(depth: number,): string {
  return `deep = ${'{ b = '.repeat(depth,)}1${' }'.repeat(depth,)}\n`;
}

/**
 * Adversarial source arbitrary: arbitrary text, raw bytes, corruptions, real
 * corpus, and moderate nesting. The overflow-depth cases are pinned as
 * `examples` rather than drawn randomly so every run exercises the regression.
 */
const adversarialSourceArbitrary = oneof(
  string(),
  string({ unit: 'binary', },),
  corruptedDocumentArbitrary,
  constantFrom(...validSources, ...invalidFixtures.map(function source(entry,) { return entry.source; },),),
  integer({
    min: 0,
    max: MODERATE_NEST_MAX,
  },).map(function toDoc(depth,) { return deepArrayDoc(depth,); },),
);

/**
 * Pinned overflow-depth examples for the totality property.
 */
const DEEP_EXAMPLES: readonly (readonly [string])[] = [
  [deepArrayDoc(DEEP_ARRAY_DEPTH,),],
  [deepInlineDoc(DEEP_INLINE_DEPTH,),],
];

/**
 * Capture whatever `parseTomlEdit` throws for `source`, or `undefined`.
 *
 * @returns Thrown value, or `undefined` when the parse succeeds.
 */
function caughtFrom(source: string,): unknown {
  try {
    parseTomlEdit({ source, },);
  }
  catch (caught: unknown) {
    return caught;
  }
  return undefined;
}

/**
 * Assert `parseTomlEdit` is total over `source`.
 *
 * Totality is two claims, not one: every throw is a `TomlEditError`, and its
 * `cause` is a legitimate parser rejection (`ParseError`) or recursion overflow
 * (`RangeError`). The second claim keeps the oracle sharp after the broad catch
 * in `safeParse`: a future input that made the parser throw some other class
 * (a genuine parser defect) would still fail here rather than be silently
 * wrapped and pass.
 *
 * @returns Nothing; throws via `expect` on a contract violation.
 */
function assertTotalParse(source: string,): void {
  try {
    /**
     * Parsed state, which must be a non-null object on the success path.
     */
    const state = parseTomlEdit({ source, },);
    expect(typeof state,).toBe('object',);
    expect(state,).not.toBeNull();
  }
  catch (caught: unknown) {
    expect(caught,).toBeInstanceOf(TomlEditError,);
    if (caught instanceof TomlEditError) {
      /**
       * Underlying cause; only a parser rejection or recursion overflow is legitimate.
       */
      const { cause, } = caught;
      expect((cause instanceof ParseError) || (cause instanceof RangeError),).toBe(true,);
    }
  }
}

//endregion Setup

await describe({
  name: parseTomlEdit.name,
  children: [
    it({
      name: 'is total: returns a state or throws only TomlEditError (incl. deep-nesting overflow)',
      timeout: RUN.timeout,
      fn: async () => {
        await assert(
          asyncProperty(adversarialSourceArbitrary, async function total(source,) {
            assertTotalParse(source,);
          },),
          {
            ...RUN.params,
            examples: [...DEEP_EXAMPLES,],
          },
        );
      },
    },),

    it({
      name: 'deep nesting overflow surfaces as TomlEditError wrapping a RangeError',
      fn: async () => {
        for (const source of [deepArrayDoc(DEEP_ARRAY_DEPTH,), deepInlineDoc(DEEP_INLINE_DEPTH,),]) {
          /**
           * Error thrown for the pathologically deep document.
           */
          const caught = caughtFrom(source,);
          expect(caught,).toBeInstanceOf(TomlEditError,);
          if (caught instanceof TomlEditError) {
            expect(caught.cause,).toBeInstanceOf(RangeError,);
          }
        }
      },
    },),

    it({
      name: 'accepts every generated document',
      timeout: RUN.timeout,
      fn: async () => {
        await assert(
          asyncProperty(documentArbitrary, async function accepts(source,) {
            /**
             * Parsed state for a known-valid generated document.
             */
            const state = parseTomlEdit({ source, },);
            expect(typeof state,).toBe('object',);
          },),
          RUN.params,
        );
      },
    },),

    it({
      name: 'rejects every committed invalid fixture with TomlEditError',
      fn: async () => {
        for (const fixture of invalidFixtures) {
          expect(function parseInvalid() {
            parseTomlEdit({ source: fixture.source, },);
          },).toThrow(TomlEditError,);
        }
      },
    },),

    it({
      name: 'splits TOML 1.0 from 1.1: newline-in-inline-table rejects at 1.0, accepts at 1.1',
      fn: async () => {
        expect(versionSplitSources.length,).toBeGreaterThan(0,);
        for (const source of versionSplitSources) {
          expect(function parseAsTen() {
            parseTomlEdit({
              source,
              tomlVersion: '1.0',
            },);
          },).toThrow(TomlEditError,);
          /**
           * Parsed state under TOML 1.1, where the construct is legal.
           */
          const state = parseTomlEdit({
            source,
            tomlVersion: '1.1',
          },);
          expect(typeof state,).toBe('object',);
        }
      },
    },),
  ],
},);
