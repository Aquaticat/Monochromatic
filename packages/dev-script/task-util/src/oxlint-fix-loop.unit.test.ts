import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  fixUntilStable,
  MAX_AUTOFIX_PASSES,
  normalizeForConvergence,
  type OxlintRunResult,
} from './oxlint-fix-loop.ts';

/**
 * Builds a normalized run result; omitted optional fields stay absent.
 *
 * @param overrides - run fields to set; `stdout`/`stderr` default to empty,
 *   `exitCode`/`signalName`/`executionError` are omitted when not given
 *
 * @returns full {@link OxlintRunResult}
 *
 * @example
 * ```ts
 * makeResult({ exitCode: 0 });
 * ```
 */
function makeResult(
  {
    stdout = '',
    stderr = '',
    exitCode,
    signalName,
    executionError,
  }: {
    readonly stdout?: string;
    readonly stderr?: string;
    readonly exitCode?: number;
    readonly signalName?: string;
    readonly executionError?: string;
  },
): OxlintRunResult {
  return {
    stdout,
    stderr,
    ...((exitCode === undefined) ? {} : { exitCode, }),
    ...((signalName === undefined) ? {} : { signalName, }),
    ...((executionError === undefined) ? {} : { executionError, }),
  };
}

/**
 * Renders a diagnostics body plus a timing footer with a given duration.
 *
 * The duration is the only volatile part of real oxlint output, so two calls
 * differing only in `ms` must normalize equal.
 *
 * @param body - stable diagnostics-and-summary text
 *
 * @param ms - timing footer duration in milliseconds
 *
 * @returns combined stdout as oxlint would print it
 *
 * @example
 * ```ts
 * withTiming({ body: 'Found 0 warnings and 1 error.', ms: 5 });
 * ```
 */
function withTiming(
  {
    body,
    ms,
  }: {
    readonly body: string;
    readonly ms: number;
  },
): string {
  return `${body}\nFinished in ${ms}ms on 1 file with 111 rules using 16 threads.`;
}

/**
 * Wraps a queue of results into a runner the loop can drain one call at a time.
 *
 * The queue is mutated by `shift`, so a test asserts `queue.length` afterward to
 * pin the exact call count; a call past the queue's end throws, proving the loop
 * never over-runs.
 *
 * @param queue - results returned in order, one per call
 *
 * @returns runner suitable for {@link fixUntilStable}'s `runFix`/`runLint`
 *
 * @example
 * ```ts
 * const fixes = [makeResult({ exitCode: 0 })];
 * await fixUntilStable({ runFix: makeScriptedRun(fixes), runLint: makeScriptedRun([clean]), maxPasses: 8 });
 * ```
 */
function makeScriptedRun(
  queue: OxlintRunResult[],
): () => Promise<OxlintRunResult> {
  return function scriptedRun(): Promise<OxlintRunResult> {
    /**
     * Next scripted result, or `undefined` once the queue is drained.
     */
    const next = queue.shift();
    if (next === undefined)
      throw new Error('scripted run queue exhausted: fixUntilStable called a runner more times than expected',);
    return Promise.resolve(next,);
  };
}

/** Stable diagnostics body used to exercise the timing-line normalization. */
const oneErrorBody = [
  '',
  '  x stylistic(chain-per-line): Put each step in this chain on its own line.',
  '    ,-[file.ts:1:11]',
  '  1 | const r = a + b * c.d.e;',
  '    :           ^^^^^^^^^^^^^',
  '    `----',
  '',
  'Found 0 warnings and 1 error.',
].join('\n',);

/**
 * Builds a dirty oracle output carrying a real diagnostic header.
 *
 * The loop's clean stop keys off {@link hasDiagnostics}, which scans for an
 * `x rule(...)` block opener, so a stand-in for "violations remain" must include
 * one; a bare `Found N errors.` summary line is not a diagnostic header.
 *
 * @param label - distinguishes otherwise-identical bodies across passes
 *
 * @returns oracle stdout with one diagnostic block and a summary
 *
 * @example
 * ```ts
 * dirtyOracle('A');
 * ```
 */
function dirtyOracle(label: string,): string {
  return [
    '',
    `  x stylistic(chain-per-line): remaining boundary ${label}.`,
    '    ,-[file.ts:1:11]',
    '  1 | const r = a + b * c.d.e;',
    '    :           ^^^^^^^^^^^^^',
    '    `----',
    '',
    'Found 0 warnings and 1 error.',
  ].join('\n',);
}

/** Dirty oracle output, variant A. */
const oracleA = dirtyOracle('A',);
/** Dirty oracle output, variant B. */
const oracleB = dirtyOracle('B',);
/** Dirty oracle output, variant C. */
const oracleC = dirtyOracle('C',);
/** Clean oracle output: summary only, no diagnostic header. */
const oracleClean = 'Found 0 warnings and 0 errors.';

await describe({
  name: '',
  children: [
    describe({
      name: normalizeForConvergence.name,
      children: [
        it({
          name: 'drops the volatile Finished-in timing line',
          fn: async () => {
            /** One run's stdout normalized; the timing footer must be gone. */
            const normalized = normalizeForConvergence(withTiming({ body: oneErrorBody, ms: 247, },),);
            expect(normalized,)
              .toBe(oneErrorBody,);
          },
        },),
        it({
          name: 'makes two runs differing only in timing compare equal',
          fn: async () => {
            /** Fast run's normalized stdout. */
            const fast = normalizeForConvergence(withTiming({ body: oneErrorBody, ms: 100, },),);
            /** Slow run's normalized stdout; identical body, slower timing footer. */
            const slow = normalizeForConvergence(withTiming({ body: oneErrorBody, ms: 999, },),);
            expect(fast,)
              .toBe(slow,);
          },
        },),
        it({
          name: 'leaves diagnostics-only output untouched',
          fn: async () => {
            expect(normalizeForConvergence(oneErrorBody,),)
              .toBe(oneErrorBody,);
          },
        },),
      ],
    },),

    describe({
      name: fixUntilStable.name,
      children: [
        it({
          name: 'stops after one pass when the oracle is clean',
          fn: async () => {
            const fixes = [
              makeResult({ exitCode: 0, },),
              makeResult({ exitCode: 0, },),
            ];
            const lints = [
              makeResult({ stdout: oracleClean, exitCode: 0, },),
              makeResult({ stdout: oracleClean, exitCode: 0, },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: MAX_AUTOFIX_PASSES,
            },);
            expect(outcome.passes,)
              .toBe(1,);
            expect(outcome.stopReason,)
              .toBe('clean',);
            expect(fixes.length,)
              .toBe(1,);
            expect(lints.length,)
              .toBe(1,);
          },
        },),
        it({
          name: 'keeps looping while the fix pass exits zero but the oracle stays dirty',
          fn: async () => {
            // The exact shape that fooled an exit-code-only stop condition:
            // every --fix pass exits 0, yet each still rewrites the file, so the
            // oracle reports a (different) remaining violation until pass 3.
            const fixes = [
              makeResult({ exitCode: 0, },),
              makeResult({ exitCode: 0, },),
              makeResult({ exitCode: 0, },),
            ];
            const lints = [
              makeResult({ stdout: oracleA, exitCode: 1, },),
              makeResult({ stdout: oracleB, exitCode: 1, },),
              makeResult({ stdout: oracleClean, exitCode: 0, },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: MAX_AUTOFIX_PASSES,
            },);
            expect(outcome.passes,)
              .toBe(3,);
            expect(outcome.stopReason,)
              .toBe('clean',);
            expect(fixes.length,)
              .toBe(0,);
            expect(lints.length,)
              .toBe(0,);
          },
        },),
        it({
          name: 'loops past a deferred-fix pass until the oracle is clean',
          fn: async () => {
            const fixes = [
              makeResult({ exitCode: 1, },),
              makeResult({ exitCode: 0, },),
            ];
            const lints = [
              makeResult({ stdout: oracleA, exitCode: 1, },),
              makeResult({ stdout: oracleClean, exitCode: 0, },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: MAX_AUTOFIX_PASSES,
            },);
            expect(outcome.passes,)
              .toBe(2,);
            expect(outcome.stopReason,)
              .toBe('clean',);
          },
        },),
        it({
          name: 'stops when an unfixable remainder makes the oracle stable',
          fn: async () => {
            const fixes = [
              makeResult({ exitCode: 1, },),
              makeResult({ exitCode: 1, },),
              makeResult({ exitCode: 1, },),
            ];
            const lints = [
              makeResult({ stdout: oracleA, exitCode: 1, },),
              makeResult({ stdout: oracleB, exitCode: 1, },),
              makeResult({ stdout: oracleB, exitCode: 1, },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: MAX_AUTOFIX_PASSES,
            },);
            expect(outcome.passes,)
              .toBe(3,);
            expect(outcome.stopReason,)
              .toBe('stable',);
          },
        },),
        it({
          name: 'treats a timing-only oracle difference as a fixpoint',
          fn: async () => {
            const fixes = [
              makeResult({ exitCode: 1, },),
              makeResult({ exitCode: 1, },),
            ];
            const lints = [
              makeResult({ stdout: withTiming({ body: oneErrorBody, ms: 188, },), exitCode: 1, },),
              makeResult({ stdout: withTiming({ body: oneErrorBody, ms: 251, },), exitCode: 1, },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: MAX_AUTOFIX_PASSES,
            },);
            expect(outcome.passes,)
              .toBe(2,);
            expect(outcome.stopReason,)
              .toBe('stable',);
          },
        },),
        it({
          name: 'stops at the cap when the oracle keeps changing',
          fn: async () => {
            const fixes = [
              makeResult({ exitCode: 1, },),
              makeResult({ exitCode: 1, },),
              makeResult({ exitCode: 1, },),
            ];
            const lints = [
              makeResult({ stdout: oracleA, exitCode: 1, },),
              makeResult({ stdout: oracleB, exitCode: 1, },),
              makeResult({ stdout: oracleC, exitCode: 1, },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: 3,
            },);
            expect(outcome.passes,)
              .toBe(3,);
            expect(outcome.stopReason,)
              .toBe('cap',);
            expect(fixes.length,)
              .toBe(0,);
            expect(lints.length,)
              .toBe(0,);
          },
        },),
        it({
          name: 'returns immediately when the fix pass cannot execute oxlint',
          fn: async () => {
            const fixes = [
              makeResult({ executionError: 'spawn oxlint ENOENT', },),
              makeResult({ exitCode: 0, },),
            ];
            const lints = [
              makeResult({ stdout: oracleClean, exitCode: 0, },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: MAX_AUTOFIX_PASSES,
            },);
            expect(outcome.passes,)
              .toBe(1,);
            expect(outcome.stopReason,)
              .toBe('execution-error',);
            // oracle never runs when the fix pass already failed
            expect(lints.length,)
              .toBe(1,);
          },
        },),
        it({
          name: 'returns immediately when the oracle lint cannot execute oxlint',
          fn: async () => {
            const fixes = [
              makeResult({ exitCode: 1, },),
            ];
            const lints = [
              makeResult({ executionError: 'spawn oxlint ENOENT', },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: MAX_AUTOFIX_PASSES,
            },);
            expect(outcome.passes,)
              .toBe(1,);
            expect(outcome.stopReason,)
              .toBe('execution-error',);
          },
        },),
        it({
          name: 'returns immediately on signal termination of a fix pass',
          fn: async () => {
            const fixes = [
              makeResult({ signalName: 'SIGTERM', },),
            ];
            const lints = [
              makeResult({ stdout: oracleClean, exitCode: 0, },),
            ];
            const outcome = await fixUntilStable({
              runFix: makeScriptedRun(fixes,),
              runLint: makeScriptedRun(lints,),
              maxPasses: MAX_AUTOFIX_PASSES,
            },);
            expect(outcome.passes,)
              .toBe(1,);
            expect(outcome.stopReason,)
              .toBe('execution-error',);
            expect(lints.length,)
              .toBe(1,);
          },
        },),
        it({
          name: 'rejects a maxPasses below one',
          fn: async () => {
            await expect(
              fixUntilStable({
                runFix: makeScriptedRun([],),
                runLint: makeScriptedRun([],),
                maxPasses: 0,
              },),
            )
              .rejects
              .toThrow(RangeError,);
          },
        },),
      ],
    },),
  ],
},);
