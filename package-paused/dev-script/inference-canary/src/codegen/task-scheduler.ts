// The probe is a single semantic unit (constants + prompt + score function).
// Splitting the scoring logic out of the probe definition would reduce readability.
/**
 * Concurrent task scheduler probe.
 *
 * Asks the model to implement a scheduler that respects dependency graphs and
 * parallelism limits. Combines topological sort, async programming, and resource
 * management; models often get concurrency limiting wrong or deadlock.
 */
import type { Probe, } from '../probe-types.ts';
import { createCodeGenProbe, } from './probe-factory.ts';

/**
 * A and B run in parallel (~100ms each), then C after both finish (~150ms total)
 */
const TASK_TEST_INPUT = 'A 100\nB 100\nC 50 A B\n';

/**
 * Allowed timing deviation in milliseconds
 */
const TIMING_TOLERANCE = 40;

/**
 * Expected completion time for A and B (run in parallel)
 */
const EXPECTED_AB_TIME = 100;

/**
 * Expected completion time for C (after A+B plus its own 50ms)
 */
const EXPECTED_C_TIME = 150;

/**
 * Total number of timing/ordering checks
 */
const TOTAL_CHECKS = 4;

/**
 * Returns the digit run that follows the first at-sign marker in `line`.
 * Locates the at-sign, then accumulates ASCII digits until the first
 * non-digit; empty when the line lacks an at-sign-then-digits field.
 *
 * @param line - candidate output line
 *
 * @returns digit run (empty when no at-sign-then-digits field exists)
 *
 * @example
 * ```ts
 * extractAtDigits('DONE A \@100'); // '100'
 * extractAtDigits('TOTAL 150');    // ''
 * ```
 */
export function extractAtDigits(line: string,): string {
  /**
   * Position of the at-sign marker; `-1` ends the search.
   */
  const at = line.indexOf('@',);
  if (at === (-1))
    return '';
  /**
   * First index of the digit run, just past the at-sign.
   */
  const start = at + 1;
  return (function collectDigits(): string {
    // Walk right past every ASCII digit, then slice the run once: a single
    // linear pass with no recursion and no per-char accumulator rebuild.
    /**
     * Cursor advanced over each ASCII digit; marks one-past the end of the run.
     */
    let end = start;
    while (end < line
      .length) {
      /**
       * Char at the cursor; the run stops at the first non-digit.
       */
      const c = line.charAt(end,);
      if ((c < '0') || (c > '9'))
        break;
      end += 1;
    }
    return line.slice(
      start,
      end,
    );
  })();
}

/**
 * {@inheritDoc Probe}
 */
export const taskScheduler: Probe = createCodeGenProbe({
  name: 'task-scheduler',
  slow: true,
  testInput: TASK_TEST_INPUT,
  prompt: [
    'Write a TypeScript CLI that simulates a concurrent task scheduler.',
    'Read a task graph from stdin in this format (one task per line):',
    '  taskName duration [dep1 dep2 ...]',
    'where duration is in milliseconds and deps are space-separated task names that must complete first.',
    '',
    'Simulate execution with these rules:',
    '- Maximum 2 tasks run concurrently',
    '- A task starts as soon as all its dependencies are complete AND a slot is available',
    '- Use actual async delays (e.g., setTimeout/Bun.sleep) with the given durations',
    '- Print each task as it completes: "DONE taskName @<elapsed_ms>"',
    '  where elapsed_ms is milliseconds since start, rounded to nearest 10',
    '- After all tasks, print "TOTAL <elapsed_ms>" with total time rounded to nearest 10',
    '',
    'Example input:',
    'A 100',
    'B 100',
    'C 50 A B',
    '',
    'Expected behavior: A and B run in parallel (2 slots), C waits for both, total ~150ms.',
    'Expected output (approximately):',
    'DONE A @100',
    'DONE B @100',
    'DONE C @150',
    'TOTAL 150',
  ]
    .join('\n',),
  verify: function verifyTaskScheduler(result,): { correctness: number; } {
    /**
     * Trimmed output lines split off stdout so each can be matched against expected prefixes.
     */
    const lines = result.stdout
      .trim()
      .split('\n',)
      .map(function trimLine(line,): string {
      return line.trim();
    },);

    if ((!lines.some(function hasDoneA(line,): boolean {
      return line.startsWith('DONE A',);
    },))
      || (!lines.some(function hasDoneB(line,): boolean {
        return line.startsWith('DONE B',);
      },))
      || (!lines.some(function hasDoneC(line,): boolean {
        return line.startsWith('DONE C',);
      },))
      || (!lines.some(function hasTotal(line,): boolean {
        return line.startsWith('TOTAL',);
      },)))
    {
      return { correctness: 0.1, };
    }

    /**
     * Extracts the \@\<ms\> timestamp from a DONE line.
     *
     * @param prefix - task name prefix to search for
     *
     * @returns parsed timestamp in ms, or -1 when not found (elapsed ms is never negative)
     */
    function extractTime(prefix: string,): number {
      /**
       * First output line starting with the requested DONE prefix, or undefined if missing.
       */
      const line = lines.find(function matchPrefix(lineItem,): boolean {
        return lineItem.startsWith(`DONE ${prefix}`,);
      },);
      if (line === undefined)
        return -1;
      /**
       * Elapsed-ms digit run captured immediately after the `@` marker;
       * empty when the line lacks a valid `@<digits>` field.
       */
      const digits = extractAtDigits(line,);
      return digits === '' ? -1 : Number(digits,);
    }

    /**
     * Elapsed ms reported for task A; -1 when the line was missing or malformed.
     */
    const timeA = extractTime('A',);
    /**
     * Elapsed ms reported for task B; -1 when the line was missing or malformed.
     */
    const timeB = extractTime('B',);
    /**
     * Elapsed ms reported for task C; -1 when the line was missing or malformed.
     */
    const timeC = extractTime('C',);

    if ((timeA < 0) || (timeB < 0)
      || (timeC < 0))
      return { correctness: 0.2, };

    /**
     * Number of timing and ordering invariants the candidate output satisfies, out of {@link TOTAL_CHECKS}.
     */
    const correctCount = [
      Math.abs(timeA - EXPECTED_AB_TIME,)
        < TIMING_TOLERANCE,
      Math.abs(timeB - EXPECTED_AB_TIME,)
        < TIMING_TOLERANCE,
      Math.abs(timeC - EXPECTED_C_TIME,)
        < TIMING_TOLERANCE,
      (timeC > timeA) && (timeC > timeB),
    ]
      .filter(Boolean,)
      .length;

    return { correctness: correctCount / TOTAL_CHECKS, };
  },
},);
