/**
 * Solution set verification for the sudoku-solver probe's --all mode.
 *
 * Validates that a puzzle output section contains the expected number of
 * valid, distinct solutions that all match the original clues.
 */
import {
  gridToString,
  isValidSolution,
  matchesClues,
  parseGrid,
  splitSolutions,
} from './sudoku-grid.ts';

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
 *
 * @example
 * ```ts
 * const ok = verifySolutionSet(section, clues, 2, 2);
 * // true when section contains exactly 2 valid distinct solutions
 * ```
 */
export function verifySolutionSet(
  section: string,
  clues: readonly (readonly number[])[],
  expectedCount: number | undefined,
  minCount: number,
): boolean {
  /** Raw solution text blocks split on blank lines within the section */
  const solutionBlocks = splitSolutions(section,);
  /** Parsed grids from solution blocks, filtering out unparseable ones */
  const grids = solutionBlocks
    .map(function parseSol(sol,): number[][] | undefined {
      return parseGrid(sol,);
    },)
    .filter(function isGrid(grid,): grid is number[][] {
      return grid !== undefined;
    },);
  /** Whether the solution count matches the expected or minimum threshold */
  const countOk = expectedCount !== undefined
    ? grids.length === expectedCount
    : grids.length >= minCount;
  if (!countOk)
    return false;
  /** Whether every parsed grid is a valid complete sudoku matching the original clues */
  const allValid = grids.every(function validateGrid(grid,): boolean {
    return isValidSolution(grid,) && matchesClues(
      grid,
      clues,
    );
  },);
  if (!allValid)
    return false;
  return new Set(grids.map(function toStr(grid,): string {
    return gridToString(grid,);
  },),)
    .size === grids.length;
}
