/**
 * Sudoku solver probe configuration.
 *
 * Asks the model to generate a backtracking sudoku solver that reads puzzles from stdin,
 * outputs solved grids, rejects unsolvable puzzles, and supports a `--all` flag to
 * enumerate every valid solution. Tests both correct solving and unsolvable detection;
 * models often fail to propagate constraints through 3x3 boxes or omit the unsolvable
 * code path entirely. The `--all` flag tests exhaustive search vs early-exit behavior.
 */
import type { Probe, } from '../probe-types.ts';
import { createCodeGenProbe, } from './probe-factory.ts';
import {
  ALL_INPUT,
  NORMAL_INPUT,
} from './sudoku-puzzles.ts';
import {
  verifyAll,
  verifyNormal,
} from './sudoku-solver-verify.ts';

//region Prompt: instructs the model to build a backtracking solver with --all support

/**
 * Prompt lines for the sudoku solver task
 */
const PROMPT = [
  'Write a TypeScript CLI that solves Sudoku puzzles read from stdin.',
  '',
  'Input format:',
  '- One or more puzzles separated by blank lines',
  '- Each puzzle is 9 lines of 9 digits where 0 means empty',
  '',
  'Output format:',
  '- Print results for each puzzle separated by a line containing only "---"',
  '- For solvable puzzles: print the solved grid (9 lines of 9 digits, no spaces)',
  '- For unsolvable puzzles: print "UNSOLVABLE"',
  '- When --all is passed (check process.argv), print ALL valid solutions for each',
  '  solvable puzzle, with each solution grid separated by a blank line',
  '- Without --all, print only the first solution found (stop searching early)',
  '',
  'Requirements:',
  '- Use backtracking with constraint checking (row, column, and 3x3 box uniqueness)',
  '- Detect and reject puzzles that have no valid solution',
  '- Check process.argv for the --all flag to switch between single and exhaustive mode',
  '- Without --all, return immediately after finding the first valid solution',
  '',
  'Example input (single puzzle):',
  '003020600',
  '900305001',
  '001806400',
  '008102900',
  '700000008',
  '006708200',
  '002609500',
  '800203009',
  '005010300',
  '',
  'Example output (single solution, no --all):',
  '483921657',
  '967345821',
  '251876493',
  '548132976',
  '729564138',
  '136798245',
  '372689514',
  '814253769',
  '695417382',
]
  .join('\n',);

//endregion Prompt

/**
 * {@inheritDoc Probe}
 */
export const sudokuSolver: Probe = createCodeGenProbe({
  name: 'sudoku-solver',
  testInput: NORMAL_INPUT,
  prompt: PROMPT,
  verify: function verifyNormalResult(result,): { correctness: number; } {
    return { correctness: verifyNormal(result.stdout,), };
  },
  additionalRuns: [
    {
      name: '--all mode',
      input: ALL_INPUT,
      transformSource: function prependAllFlag(source,): string {
        return `process.argv.push("--all");\n${source}`;
      },
      verify: function verifyAllResult(result,): { correctness: number; } {
        return { correctness: verifyAll(result.stdout,), };
      },
    },
  ],
},);
