/**
 * Code-generation probe exports.
 *
 * Assembles the four code-gen probes into the two probe lists consumed by the runner.
 * Each probe lives in its own file under src/codegen/ for independent reading.
 */
import { cssMixinTranspiler, } from './codegen/css-mixin.ts';
import { csvRfc4180, } from './codegen/csv-rfc4180.ts';
import { expressionEvaluator, } from './codegen/expr-eval.ts';
import { stakInterpreter, } from './codegen/stak.ts';
import { sudokuSolver, } from './codegen/sudoku-solver.ts';
import { taskScheduler, } from './codegen/task-scheduler.ts';

import type { Probe, } from './probes.ts';

/**
 * All probes including slow ones (--slow flag)
 */
export const codeGenProbesAll: readonly Probe[] = [
  csvRfc4180,
  expressionEvaluator,
  cssMixinTranspiler,
  sudokuSolver,
  taskScheduler,
  stakInterpreter,
];

/**
 * Fast probes only (default) -- excludes slow probes like task-scheduler
 */
export const codeGenProbes: readonly Probe[] = codeGenProbesAll.filter(
  function isFast(probe,): boolean {
    return probe.slow
      !== true;
  },
);
