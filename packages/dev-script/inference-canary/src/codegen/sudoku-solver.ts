// Probe is a single semantic unit (test data + two verify functions + prompt + probe config).
// Test data alone is ~50 lines because the probe covers three categories (solvable,
// unsolvable, multi-solution) with multiple puzzles each, plus a separate --all run.
/**
 * Sudoku solver probe.
 *
 * Asks the model to generate a backtracking sudoku solver that reads puzzles from stdin,
 * outputs solved grids, rejects unsolvable puzzles, and supports a `--all` flag to
 * enumerate every valid solution. Tests both correct solving and unsolvable detection --
 * models often fail to propagate constraints through 3x3 boxes or omit the unsolvable
 * code path entirely. The `--all` flag tests exhaustive search vs early-exit behavior.
 */
import { createCodeGenProbe, } from './probe-factory.ts';
import {
  gridToString,
  isValidSolution,
  matchesClues,
  parseGrid,
  splitPuzzleSections,
  splitSolutions,
} from './sudoku-verify.ts';

//region Test data -- normal mode

/** Classic solvable puzzle (Wikipedia example, 30 clues, unique solution) */
const SOLVABLE = [
  '530070000',
  '600195000',
  '098000060',
  '800060003',
  '400803001',
  '700020006',
  '060000280',
  '000419005',
  '000080079',
].join('\n');

/** Clue cells for the solvable puzzle */
const SOLVABLE_CLUES: readonly (readonly number[])[] = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

/**
 * Unsolvable puzzle -- box conflict in top-left 3x3.
 * Position (2,0) changed from 0 to 3, creating duplicate 3s with (0,1)=3.
 * No row or column conflicts exist, so only box-aware solvers detect this.
 */
const UNSOLVABLE_BOX = [
  '530070000',
  '600195000',
  '398000060',
  '800060003',
  '400803001',
  '700020006',
  '060000280',
  '000419005',
  '000080079',
].join('\n');

/**
 * Unsolvable puzzle -- column conflict in column 8.
 * Position (8,8) changed from 9 to 3, creating duplicate 3s with (3,8)=3.
 * No row or box conflicts exist, so only column-aware solvers detect this.
 */
const UNSOLVABLE_COL = [
  '530070000',
  '600195000',
  '098000060',
  '800060003',
  '400803001',
  '700020006',
  '060000280',
  '000419005',
  '000080073',
].join('\n');

/**
 * Multi-solution puzzle -- first band (rows 0-2) from the Wikipedia solution, rest empty.
 * 27 clues across 3 complete rows with all 3 top-band boxes valid. Leaves 6 rows
 * unconstrained enough to guarantee many valid completions while still being
 * quick to solve for the first solution (basic backtracking finds one in milliseconds).
 * Normal mode must return exactly one, proving the solver stops after the first solution.
 */
const MULTI_SOLUTION = [
  '534678912',
  '672195348',
  '198342567',
  '000000000',
  '000000000',
  '000000000',
  '000000000',
  '000000000',
  '000000000',
].join('\n');

/** Clue cells for the multi-solution puzzle */
const MULTI_CLUES: readonly (readonly number[])[] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/**
 * Stdin for normal mode: 4 puzzles separated by blank lines.
 * Order: solvable, unsolvable (box), unsolvable (column), multi-solution.
 */
const NORMAL_INPUT = [SOLVABLE, UNSOLVABLE_BOX, UNSOLVABLE_COL, MULTI_SOLUTION].join('\n\n') + '\n';

/** Number of independent correctness checks in normal mode */
const NORMAL_CHECKS = 4;

//endregion Test data -- normal mode

//region Test data -- --all mode

/**
 * Puzzle with exactly 2 solutions for --all mode testing.
 *
 * Derived from the Wikipedia solution by removing cells (0,3), (0,4), (3,3), (3,4).
 * The permutation from row 0 to row 3 has a 2-cycle at columns 3,4 (values 6 and 7).
 * Swapping these preserves all row, column, and box constraints because both affected
 * boxes ({0,1} and {1,1}) merely exchange 6 and 7 within themselves.
 *
 * Solution A: (0,3)=6, (0,4)=7, (3,3)=7, (3,4)=6
 * Solution B: (0,3)=7, (0,4)=6, (3,3)=6, (3,4)=7
 */
const TWO_SOLUTION = [
  '534008912',
  '672195348',
  '198342567',
  '859001423',
  '426853791',
  '713924856',
  '961537284',
  '287419635',
  '345286179',
].join('\n');

/** Clue cells for the 2-solution puzzle */
const TWO_SOLUTION_CLUES: readonly (readonly number[])[] = [
  [5, 3, 4, 0, 0, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 0, 0, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

/** Expected number of solutions for the 2-solution puzzle */
const EXPECTED_ALL_SOLUTIONS = 2;

/**
 * Many-solution puzzle for --all mode -- first two bands (rows 0-5) given, last band empty.
 * 54 clues with 27 empty cells concentrated in the last 3 rows. Each column has exactly
 * 3 candidate values, producing a manageable number of solutions (estimated 10-50)
 * that --all mode must enumerate completely within the container timeout.
 *
 * Including this alongside the 2-solution puzzle in --all mode catches models that
 * implement normal mode without early exit: normal mode on the 3-row MULTI_SOLUTION
 * puzzle times out if it enumerates all solutions, while --all mode on this 6-row
 * puzzle completes because the solution count is bounded.
 */
const MANY_SOLUTION = [
  '534678912',
  '672195348',
  '198342567',
  '859761423',
  '426853791',
  '713924856',
  '000000000',
  '000000000',
  '000000000',
].join('\n');

/** Clue cells for the many-solution puzzle */
const MANY_SOLUTION_CLUES: readonly (readonly number[])[] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/** Minimum number of solutions expected for the many-solution puzzle */
const MIN_MANY_SOLUTIONS = 2;

/**
 * Stdin for --all mode: 3 puzzles (2-solution + many-solution + unsolvable).
 * Tests exact enumeration, many-solution enumeration, and unsolvable rejection under --all.
 */
const ALL_INPUT = [TWO_SOLUTION, MANY_SOLUTION, UNSOLVABLE_BOX].join('\n\n') + '\n';

/** Number of independent correctness checks in --all mode */
const ALL_CHECKS = 3;

//endregion Test data -- --all mode

//region Verify functions

/**
 * Verifies normal mode output against 4 puzzles.
 *
 * Checks: solvable solved correctly, both unsolvables rejected, multi-solution
 * returns exactly one valid solution (proving early exit).
 * @param stdout - raw container stdout
 * @returns correctness fraction (correct checks / total checks)
 */
function verifyNormal(stdout: string): number {
  const sections = splitPuzzleSections(stdout);
  if (sections.length < NORMAL_CHECKS) return 0.1;

  const solvableSection = sections[0];
  const unsolvableBoxSection = sections[1];
  const unsolvableColSection = sections[2];
  const multiSection = sections[3];
  if (solvableSection === undefined || unsolvableBoxSection === undefined
    || unsolvableColSection === undefined || multiSection === undefined) {
    return 0.1;
  }

  const solvableGrid = parseGrid(solvableSection);
  const multiSolutions = splitSolutions(multiSection);
  const multiGrid = multiSolutions.length === 1 ? parseGrid(multiSolutions[0] ?? '') : undefined;

  const correctCount = [
    // Check 1: solvable puzzle solved correctly
    solvableGrid !== undefined && isValidSolution(solvableGrid) && matchesClues(solvableGrid, SOLVABLE_CLUES),
    // Check 2: box-conflict unsolvable rejected
    unsolvableBoxSection.toUpperCase() === 'UNSOLVABLE',
    // Check 3: column-conflict unsolvable rejected
    unsolvableColSection.toUpperCase() === 'UNSOLVABLE',
    // Check 4: multi-solution returns exactly 1 valid solution
    multiGrid !== undefined && isValidSolution(multiGrid) && matchesClues(multiGrid, MULTI_CLUES),
  ].filter(Boolean).length;

  return correctCount / NORMAL_CHECKS;
}

/**
 * Checks whether a puzzle section contains the expected number of valid, distinct
 * solutions that all match the given clues.
 * @param section - raw output section for one puzzle
 * @param clues - clue grid to verify solutions against
 * @param expectedCount - exact number of solutions expected, or undefined for "at least min"
 * @param minCount - minimum number of solutions when expectedCount is undefined
 * @returns true when all constraints are satisfied
 */
function verifySolutionSet(
  section: string,
  clues: readonly (readonly number[])[],
  expectedCount: number | undefined,
  minCount: number,
): boolean {
  const solutions = splitSolutions(section);
  const grids = solutions.map((sol) => parseGrid(sol)).filter((grid): grid is number[][] => grid !== undefined);
  const countOk = expectedCount !== undefined
    ? grids.length === expectedCount
    : grids.length >= minCount;
  if (!countOk) return false;
  const allValid = grids.every((grid) => isValidSolution(grid) && matchesClues(grid, clues));
  if (!allValid) return false;
  return new Set(grids.map(gridToString)).size === grids.length;
}

/**
 * Verifies --all mode output against 3 puzzles: 2-solution, many-solution, and unsolvable.
 *
 * Checks: 2-solution puzzle produces exactly 2 valid distinct solutions, many-solution
 * puzzle produces multiple valid distinct solutions, and unsolvable is still rejected.
 * @param stdout - raw container stdout
 * @returns correctness fraction (correct checks / total checks)
 */
function verifyAll(stdout: string): number {
  const sections = splitPuzzleSections(stdout);
  if (sections.length < ALL_CHECKS) return 0.1;

  const twoSolSection = sections[0];
  const manySolSection = sections[1];
  const unsolvableSection = sections[2];
  if (twoSolSection === undefined || manySolSection === undefined
    || unsolvableSection === undefined) {
    return 0.1;
  }

  const correctCount = [
    // Check 1: exactly 2 valid distinct solutions matching clues
    verifySolutionSet(twoSolSection, TWO_SOLUTION_CLUES, EXPECTED_ALL_SOLUTIONS, EXPECTED_ALL_SOLUTIONS),
    // Check 2: multiple valid distinct solutions for the many-solution puzzle
    verifySolutionSet(manySolSection, MANY_SOLUTION_CLUES, undefined, MIN_MANY_SOLUTIONS),
    // Check 3: unsolvable still rejected under --all
    unsolvableSection.toUpperCase() === 'UNSOLVABLE',
  ].filter(Boolean).length;

  return correctCount / ALL_CHECKS;
}

//endregion Verify functions

/** {@inheritDoc Probe} */
export const sudokuSolver = createCodeGenProbe({
  name: 'sudoku-solver',
  testInput: NORMAL_INPUT,
  prompt: [
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
  ].join('\n'),
  verify: (result) => ({ correctness: verifyNormal(result.stdout), }),
  additionalRuns: [
    {
      name: '--all mode',
      input: ALL_INPUT,
      transformSource: (source) => `process.argv.push("--all");\n${source}`,
      verify: (result) => ({ correctness: verifyAll(result.stdout), }),
    },
  ],
});
