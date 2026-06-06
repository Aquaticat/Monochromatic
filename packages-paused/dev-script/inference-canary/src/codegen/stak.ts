/**
 * Stak interpreter code-generation probe.
 *
 * Asks the model to implement a Stak interpreter from a prose specification.
 * Final score = combinedScore(correctness, lint) * perfScore, where:
 * - combinedScore: correctness 40%, lint 30%, type safety 30%
 * - perfScore: 1.0 when fast, linear decay to 0.0 when slow
 * Performance is a direct multiplier with no cap; a slow implementation degrades
 * the full score proportionally, not just a small fraction of it.
 */
import type { Probe, } from '../probes.ts';
import {
  CODEGEN_EXPECTED_OUTPUT,
  CODEGEN_TEST_INPUT,
  PERF_TEST_INPUT,
} from '../stak/test-cases.ts';
import { createCodeGenProbe, } from './probe-factory.ts';

/**
 * Number of correctness checks in the Stak codegen scoring function
 */
const STAK_CODEGEN_TOTAL_CHECKS = 5;

/**
 * Wall-clock duration (ms) at or below which the perf test incurs no penalty.
 * At 10M iterations, fast implementations (125ms/1M -\> 1.25s/10M) finish well under this.
 * Leaves margin for container startup variance (~150-400ms observed).
 */
const PERF_FAST_MS = 3_000;

/**
 * Wall-clock duration (ms) at or above which the perf test incurs maximum penalty.
 * Slowest observed implementation at 1M was 623ms -\> ~6.23s at 10M, which falls
 * between PERF_FAST_MS and here, creating a graded penalty across the real range.
 */
const PERF_SLOW_MS = 10_000;

/**
 * {@inheritDoc Probe}
 */
export const stakInterpreter: Probe = createCodeGenProbe({
  name: 'stak-interpreter',
  testInput: CODEGEN_TEST_INPUT,
  perfTest: {
    input: PERF_TEST_INPUT,
    fastMs: PERF_FAST_MS,
    slowMs: PERF_SLOW_MS,
  },
  prompt: [
    "Write a TypeScript CLI that reads a Stak program from stdin and writes the program's output to stdout.",
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
  ]
    .join('\n',),
  verify: function verifyStak(result,): { correctness: number; } {
    // nano-spawn strips the trailing newline from captured stdout;
    // trimEnd normalizes so the checks work regardless of trailing whitespace
    /**
     * Trimmed stdout used as the haystack for all output checks below.
     */
    const output = result.stdout
      .trimEnd();
    /**
     * Independent boolean checks against the model output; counted to yield correctness.
     */
    const checks = [
      // Floor division: -7 DIV 2 must be -4 (floor), not -3 (truncation)
      output.startsWith('-4\n',),
      // Floored mod: -7 MOD 2 must be 1 (floored), not -1 (JS remainder)
      output.includes('\n1\nHi\n',),
      // PRINTC with explicit newline code point: 72='H', 105='i', 10=LF
      output.includes('Hi\n5\n',),
      // Full countdown loop produces correct sequence
      output.endsWith('5\n4\n3\n2\n1',),
      // Exact match covers all of the above together
      output === CODEGEN_EXPECTED_OUTPUT,
    ];

    return { correctness: checks.filter(Boolean,)
      .length
      / STAK_CODEGEN_TOTAL_CHECKS, };
  },
},);
