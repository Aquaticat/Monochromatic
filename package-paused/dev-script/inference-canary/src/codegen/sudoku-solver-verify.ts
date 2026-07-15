/**
 * Verification functions for the sudoku-solver probe.
 *
 * Checks container stdout against expected puzzle solutions for both normal mode
 * (single solution + unsolvable rejection) and --all mode (exhaustive enumeration).
 * Returns fractional correctness scores consumed by the probe factory's scoring pipeline.
 */
import {
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
import { verifySolutionSet, } from './sudoku-solution-set.ts';

/**
 * Fractional score for outputs that produce sections but fail individual checks.
 * Non-zero so the fix prompt receives partial output to diagnose, rather than
 * treating it identically to a crash (which produces no output at all).
 */
const PARTIAL_CREDIT = 0.1;

//region Normal mode verification: 4 checks: solvable, 2x unsolvable, multi-solution single exit

/**
 * Verifies normal mode output against 4 puzzles.
 *
 * Checks: solvable solved correctly, both unsolvables rejected, multi-solution
 * returns exactly one valid solution (proving early exit).
 *
 * @param stdout - raw container stdout
 *
 * @returns correctness fraction (correct checks / total checks)
 *
 * @example
 * ```ts
 * const correctness = verifyNormal(containerStdout);
 * // 1.0 when all 4 checks pass
 * ```
 */
export function verifyNormal(stdout: string,): number {
  /**
   * Per-puzzle output sections split on the `---` separator
   */
  const sections = splitOutputSections(stdout,);
  if (sections.length
    < NORMAL_CHECKS)
    return PARTIAL_CREDIT;

  /**
   * Destructured puzzle output sections: solvable, two unsolvables, and multi-solution
   */
  const [solvableSection, unsolvableBoxSection, unsolvableColSection, multiSection,] =
    sections;
  if ((solvableSection === undefined)
    || (unsolvableBoxSection === undefined)
    || (unsolvableColSection === undefined)
    || (multiSection === undefined))
  {
    return PARTIAL_CREDIT;
  }

  /**
   * Parsed 9x9 grid from the solvable puzzle output, empty array on parse failure
   */
  const solvableGrid = parseGrid(solvableSection,);
  /**
   * Individual solution blocks from the multi-solution output
   */
  const multiSolutions = splitSolutions(multiSection,);
  /**
   * Parsed grid from multi-solution output, empty array unless exactly one solution is present and parses
   */
  const multiGrid = multiSolutions.length
    === 1
    ? parseGrid(multiSolutions[0]
      ?? '',)
    : [];

  /**
   * Number of checks that passed out of NORMAL_CHECKS total
   */
  const correctCount = [
    // Check 1: solvable puzzle solved correctly
    (solvableGrid.length
      > 0)
    && isValidSolution(solvableGrid,)
      && matchesClues({
      grid: solvableGrid,
      clues: SOLVABLE_CLUES,
    },),
    // Check 2: box-conflict unsolvable rejected
    unsolvableBoxSection.toUpperCase()
      === 'UNSOLVABLE',
    // Check 3: column-conflict unsolvable rejected
    unsolvableColSection.toUpperCase()
      === 'UNSOLVABLE',
    // Check 4: multi-solution returns exactly 1 valid solution
    (multiGrid.length
      > 0)
    && isValidSolution(multiGrid,)
      && matchesClues({
      grid: multiGrid,
      clues: MULTI_CLUES,
    },),
  ]
    .filter(Boolean,)
    .length;

  return correctCount / NORMAL_CHECKS;
}

//endregion Normal mode verification

//region --all mode verification: 3 checks: 2-solution exact, many-solution bounded, unsolvable

/**
 * Verifies --all mode output against 3 puzzles: 2-solution, many-solution, and unsolvable.
 *
 * Checks: 2-solution puzzle produces exactly 2 valid distinct solutions, many-solution
 * puzzle produces multiple valid distinct solutions, and unsolvable is still rejected.
 *
 * @param stdout - raw container stdout
 *
 * @returns correctness fraction (correct checks / total checks)
 *
 * @example
 * ```ts
 * const correctness = verifyAll(containerStdout);
 * // 1.0 when all 3 checks pass
 * ```
 */
export function verifyAll(stdout: string,): number {
  /**
   * Per-puzzle output sections split on the `---` separator
   */
  const sections = splitOutputSections(stdout,);
  if (sections.length
    < ALL_CHECKS)
    return PARTIAL_CREDIT;

  /**
   * Destructured --all mode output sections: 2-solution, many-solution, unsolvable
   */
  const [twoSolSection, manySolSection, unsolvableSection,] = sections;
  if ((twoSolSection === undefined)
    || (manySolSection === undefined)
    || (unsolvableSection === undefined))
  {
    return PARTIAL_CREDIT;
  }

  /**
   * Number of checks that passed out of ALL_CHECKS total
   */
  const correctCount = [
    // Check 1: exactly 2 valid distinct solutions matching clues
    verifySolutionSet({
      section: twoSolSection,
      clues: TWO_SOLUTION_CLUES,
      expectedCount: EXPECTED_TWO_SOLUTIONS,
      minCount: EXPECTED_TWO_SOLUTIONS,
    },),
    // Check 2: multiple valid distinct solutions for the many-solution puzzle
    verifySolutionSet({
      section: manySolSection,
      clues: MANY_SOLUTION_CLUES,
      minCount: MIN_MANY_SOLUTIONS,
    },),
    // Check 3: unsolvable still rejected under --all
    unsolvableSection.toUpperCase()
      === 'UNSOLVABLE',
  ]
    .filter(Boolean,)
    .length;

  return correctCount / ALL_CHECKS;
}

//endregion --all mode verification
