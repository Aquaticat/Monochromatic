// Over 100 lines due to TSDoc on locals (per guidelines) and two verify functions
// that share PARTIAL_CREDIT and verifySolutionSet. Splitting further would duplicate imports.
/**
 * Verification functions for the sudoku-solver probe.
 *
 * Checks container stdout against expected puzzle solutions for both normal mode
 * (single solution + unsolvable rejection) and --all mode (exhaustive enumeration).
 * Returns fractional correctness scores consumed by the probe factory's scoring pipeline.
 */
import {
  gridToString,
  isValidSolution,
  matchesClues,
  parseGrid,
  splitSolutions,
} from './sudoku-grid.ts';
import { splitOutputSections, } from './sudoku-output.ts';
import {
  ALL_CHECKS,
  EXPECTED_TWO_SOLUTIONS,
  MANY_SOLUTION_CLUES,
  MIN_MANY_SOLUTIONS,
  MULTI_CLUES,
  NORMAL_CHECKS,
  SOLVABLE_CLUES,
  TWO_SOLUTION_CLUES,
} from './sudoku-puzzles.ts';

/**
 * Fractional score for outputs that produce sections but fail individual checks.
 * Non-zero so the fix prompt receives partial output to diagnose, rather than
 * treating it identically to a crash (which produces no output at all).
 */
const PARTIAL_CREDIT = 0.1;

//region Normal mode verification -- 4 checks: solvable, 2x unsolvable, multi-solution single exit

/**
 * Verifies normal mode output against 4 puzzles.
 *
 * Checks: solvable solved correctly, both unsolvables rejected, multi-solution
 * returns exactly one valid solution (proving early exit).
 *
 * @param stdout - raw container stdout
 *
 * @returns correctness fraction (correct checks / total checks)
 */
export function verifyNormal(stdout: string): number {
  /** Per-puzzle output sections split on the `---` separator */
  const sections = splitOutputSections(stdout);
  if (sections.length < NORMAL_CHECKS) return PARTIAL_CREDIT;

  /** Destructured puzzle output sections: solvable, two unsolvables, and multi-solution */
  const [solvableSection, unsolvableBoxSection, unsolvableColSection, multiSection] = sections;
  if (solvableSection === undefined || unsolvableBoxSection === undefined
    || unsolvableColSection === undefined || multiSection === undefined) {
    return PARTIAL_CREDIT;
  }

  /** Parsed 9x9 grid from the solvable puzzle output, undefined on parse failure */
  const solvableGrid = parseGrid(solvableSection);
  /** Individual solution blocks from the multi-solution output */
  const multiSolutions = splitSolutions(multiSection);
  /** Parsed grid from multi-solution output (only when exactly one solution present) */
  const multiGrid = multiSolutions.length === 1 ? parseGrid(multiSolutions[0] ?? '') : undefined;

  /** Number of checks that passed out of NORMAL_CHECKS total */
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

//endregion Normal mode verification

//region --all mode verification -- 3 checks: 2-solution exact, many-solution bounded, unsolvable

/**
 * Checks whether a puzzle section contains the expected number of valid, distinct
 * solutions that all match the given clues.
 *
 * @param section - raw output section for one puzzle
 *
 * @param clues - clue grid to verify solutions against
 *
 * @param expectedCount - exact number of solutions expected, or undefined for "at least min"
 *
 * @param minCount - minimum number of solutions when expectedCount is undefined
 *
 * @returns true when all constraints are satisfied
 */
function verifySolutionSet(
  section: string,
  clues: readonly (readonly number[])[],
  expectedCount: number | undefined,
  minCount: number,
): boolean {
  /** Raw solution text blocks split on blank lines within the section */
  const solutionBlocks = splitSolutions(section);
  /** Parsed grids from solution blocks, filtering out unparseable ones */
  const grids = solutionBlocks.map(function parseSol(sol): number[][] | undefined { return parseGrid(sol); }).filter(function isGrid(grid): grid is number[][] { return grid !== undefined; });
  /** Whether the solution count matches the expected or minimum threshold */
  const countOk = expectedCount !== undefined
    ? grids.length === expectedCount
    : grids.length >= minCount;
  if (!countOk) return false;
  /** Whether every parsed grid is a valid complete sudoku matching the original clues */
  const allValid = grids.every(function validateGrid(grid): boolean { return isValidSolution(grid) && matchesClues(grid, clues); });
  if (!allValid) return false;
  return new Set(grids.map(function toStr(grid): string { return gridToString(grid); })).size === grids.length;
}

/**
 * Verifies --all mode output against 3 puzzles: 2-solution, many-solution, and unsolvable.
 *
 * Checks: 2-solution puzzle produces exactly 2 valid distinct solutions, many-solution
 * puzzle produces multiple valid distinct solutions, and unsolvable is still rejected.
 *
 * @param stdout - raw container stdout
 *
 * @returns correctness fraction (correct checks / total checks)
 */
export function verifyAll(stdout: string): number {
  /** Per-puzzle output sections split on the `---` separator */
  const sections = splitOutputSections(stdout);
  if (sections.length < ALL_CHECKS) return PARTIAL_CREDIT;

  /** Destructured --all mode output sections: 2-solution, many-solution, unsolvable */
  const [twoSolSection, manySolSection, unsolvableSection] = sections;
  if (twoSolSection === undefined || manySolSection === undefined
    || unsolvableSection === undefined) {
    return PARTIAL_CREDIT;
  }

  /** Number of checks that passed out of ALL_CHECKS total */
  const correctCount = [
    // Check 1: exactly 2 valid distinct solutions matching clues
    verifySolutionSet(twoSolSection, TWO_SOLUTION_CLUES, EXPECTED_TWO_SOLUTIONS, EXPECTED_TWO_SOLUTIONS),
    // Check 2: multiple valid distinct solutions for the many-solution puzzle
    verifySolutionSet(manySolSection, MANY_SOLUTION_CLUES, undefined, MIN_MANY_SOLUTIONS),
    // Check 3: unsolvable still rejected under --all
    unsolvableSection.toUpperCase() === 'UNSOLVABLE',
  ].filter(Boolean).length;

  return correctCount / ALL_CHECKS;
}

//endregion --all mode verification
