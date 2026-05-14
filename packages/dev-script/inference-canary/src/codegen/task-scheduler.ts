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

/** A and B run in parallel (~100ms each), then C after both finish (~150ms total) */
const TASK_TEST_INPUT = 'A 100\nB 100\nC 50 A B\n';

/** Allowed timing deviation in milliseconds */
const TIMING_TOLERANCE = 40;

/** Expected completion time for A and B (run in parallel) */
const EXPECTED_AB_TIME = 100;

/** Expected completion time for C (after A+B plus its own 50ms) */
const EXPECTED_C_TIME = 150;

/** Total number of timing/ordering checks */
const TOTAL_CHECKS = 4;

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
    const lines = result.stdout.trim().split('\n',).map(function trimLine(line,): string {
      return line.trim();
    },);

    if (!lines.some(function hasDoneA(line,): boolean {
      return line.startsWith('DONE A',);
    },)
      || !lines.some(function hasDoneB(line,): boolean {
        return line.startsWith('DONE B',);
      },)
      || !lines.some(function hasDoneC(line,): boolean {
        return line.startsWith('DONE C',);
      },)
      || !lines.some(function hasTotal(line,): boolean {
        return line.startsWith('TOTAL',);
      },))
    {
      return { correctness: 0.1, };
    }

    /**
     * Extracts the \@\<ms\> timestamp from a DONE line.
     *
     * @param prefix - task name prefix to search for
     *
     * @returns parsed timestamp in ms, or undefined when not found
     */
    function extractTime(prefix: string,): number | undefined {
      const line = lines.find(function matchPrefix(lineItem,): boolean {
        return lineItem.startsWith(`DONE ${prefix}`,);
      },);
      if (line === undefined)
        return undefined;
      const match = /@(\d+)/.exec(line,);
      return match !== null ? Number(match[1],) : undefined;
    }

    const timeA = extractTime('A',);
    const timeB = extractTime('B',);
    const timeC = extractTime('C',);

    if (timeA === undefined || timeB === undefined || timeC === undefined)
      return { correctness: 0.2, };

    const correctCount = [
      Math.abs(timeA - EXPECTED_AB_TIME,) < TIMING_TOLERANCE,
      Math.abs(timeB - EXPECTED_AB_TIME,) < TIMING_TOLERANCE,
      Math.abs(timeC - EXPECTED_C_TIME,) < TIMING_TOLERANCE,
      timeC > timeA && timeC > timeB,
    ]
      .filter(Boolean,)
      .length;

    return { correctness: correctCount / TOTAL_CHECKS, };
  },
},);
