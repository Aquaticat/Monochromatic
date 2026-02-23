// The probe is a single semantic unit (constants + prompt + score function).
// Splitting the scoring logic out of the probe definition would reduce readability.
/**
 * Concurrent task scheduler probe.
 *
 * Asks the model to implement a scheduler that respects dependency graphs and
 * parallelism limits. Combines topological sort, async programming, and resource
 * management -- models often get concurrency limiting wrong or deadlock.
 */
import { runInContainer, } from '../container.ts';

import { CODE_GEN_SYSTEM, } from './system-prompt.ts';
import { buildCodeGenFixPrompt, combinedScore, extractCode, lintAndLog, } from './scoring.ts';

import type { LintResult, } from '../linter.ts';
import type { Probe, } from '../probes.ts';

/**
 * Lint results from the most recent score() call, keyed by model ID.
 * Used by buildFixPrompt to avoid re-linting the same source that score() already analyzed.
 */
const lintCache = new Map<string, LintResult>();

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

/** {@inheritDoc Probe} */
export const taskScheduler: Probe = {
  name: 'task-scheduler',
  category: 'code-gen',
  slow: true,
  buildFixPrompt: (response, context) => buildCodeGenFixPrompt(response, context, lintCache.get(context.modelId)),
  system: CODE_GEN_SYSTEM,
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
  ].join('\n'),
  score: async (response, context) => {
    const source = extractCode(response);
    const [result, lint] = await Promise.all([
      runInContainer(source, TASK_TEST_INPUT),
      lintAndLog(source, 'task-scheduler', context),
    ]);
    lintCache.set(context.modelId, lint);

    if (result.timedOut || result.exitCode !== 0) return combinedScore(0, lint);

    const lines = result.stdout.trim().split('\n').map((line) => line.trim());

    if (!lines.some((line) => line.startsWith('DONE A'))
      || !lines.some((line) => line.startsWith('DONE B'))
      || !lines.some((line) => line.startsWith('DONE C'))
      || !lines.some((line) => line.startsWith('TOTAL'))) {
      return combinedScore(0.1, lint);
    }

    /** Extracts the @<ms> timestamp from a DONE line */
    const extractTime = (prefix: string): number | undefined => {
      const line = lines.find((lineItem) => lineItem.startsWith(`DONE ${prefix}`));
      if (line === undefined) return undefined;
      const match = /@(\d+)/.exec(line);
      return match !== null ? Number(match[1]) : undefined;
    };

    const timeA = extractTime('A');
    const timeB = extractTime('B');
    const timeC = extractTime('C');

    if (timeA === undefined || timeB === undefined || timeC === undefined) {
      return combinedScore(0.2, lint);
    }

    const correctCount = [
      Math.abs(timeA - EXPECTED_AB_TIME) < TIMING_TOLERANCE,
      Math.abs(timeB - EXPECTED_AB_TIME) < TIMING_TOLERANCE,
      Math.abs(timeC - EXPECTED_C_TIME) < TIMING_TOLERANCE,
      timeC > timeA && timeC > timeB,
    ].filter(Boolean).length;

    return combinedScore(correctCount / TOTAL_CHECKS, lint);
  },
};
