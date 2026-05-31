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
 * Options for {@link verifySolutionSet}.
 *
 * @example
 * ```ts
 * const options: VerifySolutionSetOptions = {
 *   section: 'raw output',
 *   clues: CLUE_GRID,
 *   expectedCount: 2,
 *   minCount: 2,
 * };
 * ```
 */
type VerifySolutionSetOptions = {
  /**
   * Raw output section for one puzzle
   */
  readonly section: string;
  /**
   * Clue grid to verify solutions against
   */
  readonly clues: readonly (readonly number[])[];
  /**
   * Exact number of solutions expected, omitted for "at least min"
   */
  readonly expectedCount?: number;
  /**
   * Minimum number of solutions when expectedCount is absent
   */
  readonly minCount: number;
};

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
 * const ok = verifySolutionSet({ section, clues, expectedCount: 2, minCount: 2 });
 * // true when section contains exactly 2 valid distinct solutions
 * ```
 */
export function verifySolutionSet({
  section,
  clues,
  expectedCount,
  minCount,
}: VerifySolutionSetOptions,): boolean {
  /**
   * Raw solution text blocks split on blank lines within the section
   */
  const solutionBlocks = splitSolutions(section,);
  /**
   * Parsed grids from solution blocks, filtering out unparseable ones (empty array result)
   */
  const grids = solutionBlocks
    .map(function parseSol(sol,): number[][] {
      return parseGrid(sol,);
    },)
    .filter(function isGrid(grid,): boolean {
      return grid.length
        > 0;
    },);
  /**
   * Whether the solution count matches the expected or minimum threshold
   */
  const countOk = expectedCount !== undefined
    ? grids.length
      === expectedCount
    : grids.length
      >= minCount;
  if (!countOk)
    return false;
  /**
   * Whether every parsed grid is a valid complete sudoku matching the original clues
   */
  const allValid = grids.every(function validateGrid(grid,): boolean {
    return isValidSolution(grid,)
      && matchesClues({
      grid,
      clues,
    },);
  },);
  if (!allValid)
    return false;
  return new Set(grids.map(function toStr(grid,): string {
    return gridToString(grid,);
  },),)
    .size
    === grids
    .length;
}
