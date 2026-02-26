/**
 * Stak interpreter code-generation probe.
 *
 * Asks the model to implement a Stak interpreter from a prose specification.
 * Final score = combinedScore(correctness, lint) * perfScore, where:
 * - combinedScore: correctness 40%, lint 30%, type safety 30%
 * - perfScore: 1.0 when fast, linear decay to 0.0 when slow
 * Performance is a direct multiplier with no cap -- a slow implementation degrades
 * the full score proportionally, not just a small fraction of it.
 */
import { runInContainer, } from '../container.ts';

import { CODE_GEN_SYSTEM, } from './system-prompt.ts';
import { buildCodeGenFixPrompt, combinedScore, extractCode, lintAndLog, } from './scoring.ts';
import { CODEGEN_TEST_INPUT, CODEGEN_EXPECTED_OUTPUT, PERF_TEST_INPUT, } from '../stak/test-cases.ts';
import { PERF_EXPECTED_OUTPUT, } from '../stak/perf-expected-output.ts';

import type { ContainerResult, } from '../container.ts';
import type { LintResult, } from '../linter.ts';
import type { Probe, } from '../probes.ts';

/**
 * Lint results from the most recent score() call, keyed by model ID.
 * Used by buildFixPrompt to avoid re-linting the same source that score() already analyzed.
 */
const lintCache = new Map<string, LintResult>();

/**
 * Container results from the most recent score() call, keyed by model ID.
 * Used by buildFixPrompt to include runtime errors in the second-pass prompt.
 */
const containerCache = new Map<string, ContainerResult>();

/**
 * Performance test results from the most recent score() call, keyed by model ID.
 * Used by buildFixPrompt to tell the model it was slow and why.
 */
const perfCache = new Map<string, TimedContainerResult>();

/** Number of correctness checks in the Stak codegen scoring function */
const STAK_CODEGEN_TOTAL_CHECKS = 5;

/**
 * Wall-clock duration (ms) at or below which the perf test incurs no penalty.
 * At 10M iterations, fast implementations (125ms/1M → 1.25s/10M) finish well under this.
 * Leaves margin for container startup variance (~150-400ms observed).
 */
const PERF_FAST_MS = 3_000;

/**
 * Wall-clock duration (ms) at or above which the perf test incurs maximum penalty.
 * Slowest observed implementation at 1M was 623ms → ~6.23s at 10M, which falls
 * between PERF_FAST_MS and here, creating a graded penalty across the real range.
 */
const PERF_SLOW_MS = 10_000;

// PERF_EXPECTED_OUTPUT is imported from stak/perf-expected-output.ts (precomputed).
// Recomputing at runtime would add ~8s to startup (10M LCG iterations in the reference interpreter).

/** Container result bundled with its wall-clock duration */
type TimedContainerResult = ContainerResult & {
  /** Wall-clock milliseconds from start of runInContainer call to resolution */
  readonly durationMs: number;
};

/**
 * Runs a container and records wall-clock duration alongside the result.
 * @param source - TypeScript source to execute
 * @param input - stdin data
 * @param signal - abort signal
 * @returns container result with durationMs attached
 */
async function runInContainerTimed(
  source: string,
  input: string,
  signal: AbortSignal | undefined,
): Promise<TimedContainerResult> {
  const start = Date.now();
  const result = await runInContainer(source, input, signal);
  return { ...result, durationMs: Date.now() - start, };
}

/**
 * Converts a perf container result and its duration into a 0-1 score.
 * Returns 0 if the output is wrong (correctness gating before rewarding speed).
 * @param perfResult - timed container result from the perf test
 * @returns perf score between 0 (slow/wrong) and 1 (fast and correct)
 */
function computePerfScore(perfResult: TimedContainerResult): number {
  if (perfResult.timedOut || perfResult.exitCode !== 0) return 0;
  if (perfResult.stdout !== PERF_EXPECTED_OUTPUT) return 0;
  if (perfResult.durationMs <= PERF_FAST_MS) return 1;
  if (perfResult.durationMs >= PERF_SLOW_MS) return 0;
  return 1 - (perfResult.durationMs - PERF_FAST_MS) / (PERF_SLOW_MS - PERF_FAST_MS);
}

/** {@inheritDoc Probe} */
export const stakInterpreter: Probe = {
  name: 'stak-interpreter',
  category: 'code-gen',
  system: CODE_GEN_SYSTEM,
  buildFixPrompt: async (response, context) => {
    const base = await buildCodeGenFixPrompt(
      response, context,
      lintCache.get(context.modelId),
      containerCache.get(context.modelId),
    );

    const perf = perfCache.get(context.modelId);
    if (perf === undefined || computePerfScore(perf) >= 1) return base;

    const perfDiag = [
      '=== performance issue ===',
      `Your implementation took ${String(perf.durationMs)}ms on the performance test (target: under ${String(PERF_FAST_MS)}ms).`,
      'Optimize for throughput on programs with many iterations.',
    ].join('\n');

    if (base === undefined) {
      return [
        'Here is your code from the previous response:',
        '',
        '```typescript',
        extractCode(response),
        '```',
        '',
        perfDiag,
        '',
        'Fix the performance issue. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
      ].join('\n');
    }

    return `${base}\n\n${perfDiag}\n\nFix all the issues including the performance problem above. Output ONLY the complete fixed TypeScript source in a single fenced code block.`;
  },
  prompt: [
    'Write a TypeScript CLI that reads a Stak program from stdin and writes the program\'s output to stdout.',
    '',
    'Stak is a minimal stack-based language. Each instruction occupies exactly one line.',
    'Blank lines are ignored. Instructions are case-sensitive.',
    '',
    'Instructions:',
    '1.  Integer literal (e.g. `42`, `-7`): push the integer onto the stack',
    '2.  `ADD` -- pop b, pop a, push a + b',
    '3.  `SUB` -- pop b, pop a, push a - b',
    '4.  `MUL` -- pop b, pop a, push a * b',
    '5.  `DIV` -- pop b, pop a, push floor(a / b)',
    '    Uses floor division (rounds toward -Infinity, not toward zero)',
    '    Example: -7 DIV 2 = -4, not -3',
    '6.  `MOD` -- pop b, pop a, push the floored remainder (result has the same sign as b)',
    '    Example: -7 MOD 2 = 1 (because -7 = 2 * (-4) + 1)',
    '7.  `DUP` -- push a copy of the top value',
    '8.  `SWAP` -- swap the top two values',
    '9.  `DROP` -- discard the top value',
    '10. `PRINT` -- pop and print the value as a decimal integer followed by a newline',
    '11. `PRINTC` -- pop and emit the value as a Unicode character (no newline); use String.fromCodePoint',
    '12. `STORE name` -- pop the top value into the named variable (e.g. `STORE x`)',
    '13. `LOAD name` -- push the value of the named variable (throw if not yet stored)',
    '14. `LABEL name` -- marks a jump target; no stack effect',
    '15. `JUMP name` -- unconditional jump to the named label',
    '16. `JUMPZ name` -- pop the top value; if zero, jump to the named label; otherwise continue',
    '    JUMPZ always pops, even when not jumping',
    '',
    'Example:',
    '```',
    '5',
    'STORE n',
    'LABEL top',
    'LOAD n',
    'JUMPZ done',
    'LOAD n',
    'PRINT',
    'LOAD n',
    '1',
    'SUB',
    'STORE n',
    'JUMP top',
    'LABEL done',
    '```',
    'Output:',
    '```',
    '5',
    '4',
    '3',
    '2',
    '1',
    '```',
    '',
    'Requirements:',
    '- Labels are resolved in a first pass before execution begins (forward jumps must work)',
    '- Stack underflow must throw an Error',
    '- LOAD on an undefined variable must throw an Error',
  ].join('\n'),
  score: async (response, context) => {
    const source = extractCode(response);
    const [result, perfResult, lint] = await Promise.all([
      runInContainer(source, CODEGEN_TEST_INPUT, context.signal),
      runInContainerTimed(source, PERF_TEST_INPUT, context.signal),
      lintAndLog(source, 'stak-interpreter', context),
    ]);
    lintCache.set(context.modelId, lint);
    containerCache.set(context.modelId, result);
    perfCache.set(context.modelId, perfResult);

    const perfScore = computePerfScore(perfResult);
    console.log(
      `  [${context.modelId}:stak-interpreter] perf: ${String(perfResult.durationMs)}ms score=${perfScore.toFixed(2)}`,
    );

    if (result.timedOut || result.exitCode !== 0) {
      console.log(`  [${context.modelId}:stak-interpreter] correctness container failed: exit=${String(result.exitCode)} stderr=${result.stderr.slice(0, 200)}`);
      return combinedScore(0, lint) * perfScore;
    }

    const output = result.stdout;
    const checks = [
      // Floor division: -7 DIV 2 must be -4 (floor), not -3 (truncation)
      output.startsWith('-4\n'),
      // Floored mod: -7 MOD 2 must be 1 (floored), not -1 (JS remainder)
      output.includes('\n1\nHi\n'),
      // PRINTC with explicit newline code point: 72='H', 105='i', 10=LF
      output.includes('Hi\n5\n'),
      // Full countdown loop produces correct sequence
      output.includes('5\n4\n3\n2\n1\n'),
      // Exact match covers all of the above together
      output === CODEGEN_EXPECTED_OUTPUT,
    ];

    const correctness = checks.filter(Boolean).length / STAK_CODEGEN_TOTAL_CHECKS;
    return combinedScore(correctness, lint) * perfScore;
  },
};
