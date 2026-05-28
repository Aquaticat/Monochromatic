/**
 * Property-based tests for `formatErrorDeep` and `formatFailure` from
 * `./format-error.ts`, driven by fast-check.
 *
 * Example-based tests in `format-error.unit.test.ts` cover specific
 * fixtures; these properties fuzz the wide-input surfaces where the
 * harness must behave in every situation:
 *
 * - totality: the formatter resolves to string lines for arbitrary
 *   thrown values without throwing itself
 * - cycle safety: self-referential and ring-shaped `.cause` chains
 *   terminate and emit the `... (cycle)` marker exactly once
 * - aggregate membership: every `AggregateError.errors` member is
 *   rendered on its own `[N/M]`-prefixed line
 * - stack-frame filtering: harness/chai/sinon frames are dropped while
 *   user frames survive, regardless of interleaving
 * - summary fusion: `formatFailure` always preserves the summary prefix
 *
 * fast-check is an internal dev tool for this self-test only; it is not
 * a dependency of the published harness and never reaches consumers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  anything,
  array,
  assert,
  asyncProperty,
  constantFrom,
  integer,
  letrec,
  oneof,
  record,
  string,
  type Arbitrary,
} from 'fast-check';

import {
  formatErrorDeep,
  formatFailure,
} from './format-error.ts';

//region Constants

/**
 * Property runs per `assert`. High enough to explore the branch space,
 * low enough that five properties times this count stay well under the
 * per-test timeout.
 */
const NUM_RUNS = 100;

/**
 * Per-property timeout. The default `it` timeout is tuned for a single
 * assertion; a property runs the body `NUM_RUNS` times, so it needs a
 * wider budget even though each run is sub-millisecond.
 */
const PROPERTY_TIMEOUT_MS = 30_000;

/** Upper bound on generated identifier-token length; keeps fixtures small. */
const MAX_WORD_LENGTH = 12;

/** Upper bound on generated cause-chain depth before the cycle is closed. */
const MAX_CHAIN_DEPTH = 8;

/** Upper bound on generated `AggregateError.errors` member count. */
const MAX_AGGREGATE_MEMBERS = 6;

/** Upper bound on generated user-code frames in a synthetic stack. */
const MAX_USER_FRAMES = 5;

/** Upper bound on generated harness frames in a synthetic stack. */
const MAX_HARNESS_FRAMES = 6;

/**
 * Alphabet for generated identifier tokens: lowercase letters and
 * digits only, so a generated token can never contain a `/` (and thus
 * never accidentally form a harness path fragment) or a newline (which
 * would corrupt synthetic `.stack` construction). Listed as explicit
 * single characters rather than spreading a string literal, which the
 * `no-misused-spread` rule flags for its Unicode-code-point hazard.
 */
const SAFE_CHARS: readonly string[] = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];

/**
 * Mirror of `HARNESS_INTERNAL_FRAGMENTS` in `./format-error.ts`. The
 * source list is not exported (it is module-private), so it is copied
 * here. If the source list changes, update this mirror; the
 * stack-frame-filter property asserts none of these survive the format.
 */
const HARNESS_INTERNAL_FRAGMENTS: readonly string[] = [
  'packages/module/test/dist/',
  'module-test/dist/',
  'node_modules/chai/',
  'node_modules/chai-as-promised/',
  'node_modules/sinon-chai/',
  'node_modules/sinon/',
];

//endregion Constants

//region Arbitraries

/**
 * Single identifier token of {@link SAFE_CHARS} characters; the unit of
 * generated messages, names, and frame tokens.
 */
const safeWordArbitrary = string({
  minLength: 1,
  maxLength: MAX_WORD_LENGTH,
  unit: constantFrom(...SAFE_CHARS,),
},);

/**
 * Recursively-shaped error-like value arbitrary. Each node optionally
 * carries `name`, `message`, `stack`, a recursive `cause`, and a
 * recursive `errors` array, so the generated values drive the
 * message/label fallbacks, the cause-chain walk, and the aggregate
 * expansion. `letrec` bounds the recursion depth; `anything()` leaves
 * mix in non-error shapes (primitives, plain objects, arrays).
 *
 * @returns arbitrary producing error-like values of unknown shape
 */
function buildErrorLikeArbitrary(): Arbitrary<unknown> {
  const { node, } = letrec(function defineErrorLike(tie,) {
    return {
      node: record(
        {
          name: oneof(safeWordArbitrary, integer(),),
          message: oneof(safeWordArbitrary, integer(),),
          stack: safeWordArbitrary,
          cause: oneof(tie('node',), anything(),),
          errors: array(tie('node',), { maxLength: MAX_AGGREGATE_MEMBERS, },),
        },
        { requiredKeys: [], },
      ),
    };
  },);
  return node;
}

/** Error-like value arbitrary, instantiated once for reuse across properties. */
const errorLikeArbitrary = buildErrorLikeArbitrary();

//endregion Arbitraries

//region Fixture builders

/**
 * Builds `depth` distinct `Error` nodes linked into a ring through
 * `.cause`: node `i` points at node `i + 1`, and the last points back
 * at node `0`. Returned as the node array so callers pass the root
 * (`nodes[0]`) without a non-null assertion; the formatter accepts an
 * unknown value.
 *
 * @param depth - number of distinct nodes in the ring (at least 1; a
 *   depth of 1 yields a self-referential node)
 *
 * @returns ring of error nodes, root first
 */
function buildCyclicCauseChain({ depth, }: { readonly depth: number; },): readonly Error[] {
  const nodes = Array.from({ length: depth, }, function makeNode(_unused, index,) {
    return new Error(`node-${String(index,)}`,);
  },);
  nodes.forEach(function linkToNext(node, index,) {
    (node as Error & { cause?: unknown; }).cause = nodes[(index + 1) % depth];
  },);
  return nodes;
}

/**
 * Builds an aggregate-shaped plain object whose `.errors` are distinct
 * stack-less member objects, so the rendered line count is exactly one
 * (root) plus the member count.
 *
 * @param memberMessages - one message per aggregate member
 *
 * @returns aggregate-shaped value of unknown type
 */
function buildAggregate({ memberMessages, }: { readonly memberMessages: readonly string[]; },): unknown {
  const members = memberMessages.map(function toMember(message,) {
    return {
      name: 'Error',
      message,
    };
  },);
  return {
    name: 'AggregateError',
    message: 'multiple failures',
    errors: members,
  };
}

/**
 * Interleaves two frame lists element by element, dropping the
 * trailing tail of the longer list's missing counterpart. Tests that
 * harness-frame filtering is position-independent.
 *
 * @param a - first frame list
 *
 * @param b - second frame list
 *
 * @returns interleaved frames in `a[0], b[0], a[1], b[1], ...` order
 */
function interleaveFrames({
  a,
  b,
}: {
  readonly a: readonly string[];
  readonly b: readonly string[];
},): readonly string[] {
  const maxLength = Math.max(a.length, b.length,);
  return Array.from({ length: maxLength, }, function pickPair(_unused, index,) {
    return [a[index], b[index],];
  },)
    .flat()
    .filter(function defined(frame,): frame is string {
      return frame !== undefined;
    },);
}

/**
 * Builds an error-like object whose synthetic `.stack` interleaves
 * generated user frames (under `packages/app/src/`, which matches no
 * harness fragment) with harness frames built from the supplied
 * fragments. A header line (`Error: <message>`) is prepended so the
 * formatter's first-line-duplicate-skip branch fires.
 *
 * @param message - error message, also used in the synthetic header
 *
 * @param userTokens - identifier tokens for user-frame filenames
 *
 * @param fragments - harness path fragments to embed in harness frames
 *
 * @returns error-like value of unknown type carrying the synthetic stack
 */
function buildErrorWithMixedStack({
  message,
  userTokens,
  fragments,
}: {
  readonly message: string;
  readonly userTokens: readonly string[];
  readonly fragments: readonly string[];
},): unknown {
  const userFrames = userTokens.map(function toUserFrame(token, index,) {
    return `at userFn (packages/app/src/${token}-${String(index,)}.ts:${String(index + 1,)}:1)`;
  },);
  const harnessFrames = fragments.map(function toHarnessFrame(fragment, index,) {
    return `at harnessFn (${fragment}runner-${String(index,)}.js:${String(index + 1,)}:1)`;
  },);
  const stack = [
    `Error: ${message}`,
    ...interleaveFrames({
      a: userFrames,
      b: harnessFrames,
    },).map(function indentFrame(frame,) {
      return `    ${frame}`;
    },),
  ].join('\n',);
  return {
    name: 'Error',
    message,
    stack,
  };
}

//endregion Fixture builders

await describe({
  name: 'format-error (property)',
  children: [
    //region Totality

    it({
      name: 'formatErrorDeep resolves to string lines for arbitrary values without throwing',
      timeout: PROPERTY_TIMEOUT_MS,
      fn: async () => {
        await assert(
          asyncProperty(
            oneof(errorLikeArbitrary, anything(),),
            async function neverThrows(value,) {
              const lines = await formatErrorDeep(value,);
              expect(Array.isArray(lines,),).toBe(true,);
              lines.forEach(function assertString(line,) {
                expect(typeof line,).toBe('string',);
              },);
            },
          ),
          { numRuns: NUM_RUNS, },
        );
      },
    },),

    //endregion Totality

    //region Cycle safety

    it({
      name: 'cyclic cause chains terminate and emit exactly one cycle marker',
      timeout: PROPERTY_TIMEOUT_MS,
      fn: async () => {
        await assert(
          asyncProperty(
            integer({
              min: 1,
              max: MAX_CHAIN_DEPTH,
            },),
            async function terminatesWithCycleMarker(depth,) {
              const chain = buildCyclicCauseChain({ depth, },);
              const lines = await formatErrorDeep(chain[0],);
              expect(lines.length,).toBe(depth + 1,);
              const cycleLines = lines.filter(function isCycleLine(line,) {
                return line.includes('... (cycle)',);
              },);
              expect(cycleLines.length,).toBe(1,);
            },
          ),
          { numRuns: NUM_RUNS, },
        );
      },
    },),

    //endregion Cycle safety

    //region Aggregate membership

    it({
      name: 'every AggregateError member renders on its own indexed line',
      timeout: PROPERTY_TIMEOUT_MS,
      fn: async () => {
        await assert(
          asyncProperty(
            array(safeWordArbitrary, {
              minLength: 1,
              maxLength: MAX_AGGREGATE_MEMBERS,
            },),
            async function rendersEachMember(memberMessages,) {
              const memberCount = memberMessages.length;
              const lines = await formatErrorDeep(buildAggregate({ memberMessages, },),);
              expect(lines.length,).toBe(memberCount + 1,);
              for (let index = 0; index < memberCount; index += 1) {
                const prefix = `[${String(index + 1,)}/${String(memberCount,)}] `;
                expect(
                  lines.some(function hasPrefix(line,) {
                    return line.startsWith(prefix,);
                  },),
                ).toBe(true,);
              }
            },
          ),
          { numRuns: NUM_RUNS, },
        );
      },
    },),

    //endregion Aggregate membership

    //region Stack-frame filtering

    it({
      name: 'harness frames are dropped while user frames survive, in any interleaving',
      timeout: PROPERTY_TIMEOUT_MS,
      fn: async () => {
        await assert(
          asyncProperty(
            record({
              message: safeWordArbitrary,
              userTokens: array(safeWordArbitrary, {
                minLength: 1,
                maxLength: MAX_USER_FRAMES,
              },),
              fragments: array(constantFrom(...HARNESS_INTERNAL_FRAGMENTS,), {
                minLength: 1,
                maxLength: MAX_HARNESS_FRAMES,
              },),
            },),
            async function filtersHarnessFrames({
              message,
              userTokens,
              fragments,
            },) {
              const joined = (await formatErrorDeep(
                buildErrorWithMixedStack({
                  message,
                  userTokens,
                  fragments,
                },),
              )).join('\n',);
              HARNESS_INTERNAL_FRAGMENTS.forEach(function assertFragmentDropped(fragment,) {
                expect(joined.includes(fragment,),).toBe(false,);
              },);
              userTokens.forEach(function assertTokenSurvives(token, index,) {
                expect(joined.includes(`${token}-${String(index,)}.ts`,),).toBe(true,);
              },);
            },
          ),
          { numRuns: NUM_RUNS, },
        );
      },
    },),

    //endregion Stack-frame filtering

    //region Summary fusion

    it({
      name: 'formatFailure preserves the summary prefix for arbitrary values',
      timeout: PROPERTY_TIMEOUT_MS,
      fn: async () => {
        await assert(
          asyncProperty(
            record({
              summary: string(),
              value: oneof(errorLikeArbitrary, anything(),),
            },),
            async function preservesSummary({
              summary,
              value,
            },) {
              const result = await formatFailure({
                summary,
                value,
              },);
              expect(typeof result,).toBe('string',);
              expect(result.startsWith(summary,),).toBe(true,);
            },
          ),
          { numRuns: NUM_RUNS, },
        );
      },
    },),

    //endregion Summary fusion
  ],
},);
