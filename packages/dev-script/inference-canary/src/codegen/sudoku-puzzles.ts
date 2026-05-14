// Fixture file: puzzle grids and clue arrays are inherently verbose data declarations.
// Splitting further would scatter related puzzle/clue pairs across files.
/**
 * Sudoku puzzle test data for the sudoku-solver probe.
 *
 * Contains puzzle grids, clue arrays, and assembled stdin strings for both
 * normal mode (single solution + unsolvable detection) and --all mode
 * (exhaustive enumeration). Each puzzle's construction rationale is documented
 * to make the expected behavior verifiable by inspection.
 */

//region Normal mode puzzles: solvable, two unsolvable variants, multi-solution

/** Classic solvable puzzle (Wikipedia example, 30 clues, unique solution) */
export const SOLVABLE: string = [
  '530070000',
  '600195000',
  '098000060',
  '800060003',
  '400803001',
  '700020006',
  '060000280',
  '000419005',
  '000080079',
]
  .join('\n',);

/** Clue cells for the solvable puzzle, used by verifiers to confirm solutions match */
export const SOLVABLE_CLUES: readonly (readonly number[])[] = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0,],
  [6, 0, 0, 1, 9, 5, 0, 0, 0,],
  [0, 9, 8, 0, 0, 0, 0, 6, 0,],
  [8, 0, 0, 0, 6, 0, 0, 0, 3,],
  [4, 0, 0, 8, 0, 3, 0, 0, 1,],
  [7, 0, 0, 0, 2, 0, 0, 0, 6,],
  [0, 6, 0, 0, 0, 0, 2, 8, 0,],
  [0, 0, 0, 4, 1, 9, 0, 0, 5,],
  [0, 0, 0, 0, 8, 0, 0, 7, 9,],
];

/**
 * Unsolvable puzzle; box conflict in top-left 3x3.
 * Position (2,0) changed from 0 to 3, creating duplicate 3s with (0,1)=3.
 * No row or column conflicts exist, so only box-aware solvers detect this.
 */
export const UNSOLVABLE_BOX: string = [
  '530070000',
  '600195000',
  '398000060',
  '800060003',
  '400803001',
  '700020006',
  '060000280',
  '000419005',
  '000080079',
]
  .join('\n',);

/**
 * Unsolvable puzzle; column conflict in column 8.
 * Position (8,8) changed from 9 to 3, creating duplicate 3s with (3,8)=3.
 * No row or box conflicts exist, so only column-aware solvers detect this.
 */
export const UNSOLVABLE_COL: string = [
  '530070000',
  '600195000',
  '098000060',
  '800060003',
  '400803001',
  '700020006',
  '060000280',
  '000419005',
  '000080073',
]
  .join('\n',);

/**
 * Multi-solution puzzle; first band (rows 0-2) from the Wikipedia solution, rest empty.
 * 27 clues across 3 complete rows with all 3 top-band boxes valid. Leaves 6 rows
 * unconstrained enough to guarantee many valid completions while still being
 * quick to solve for the first solution (basic backtracking finds one in milliseconds).
 * Normal mode must return exactly one, proving the solver stops after the first solution.
 */
export const MULTI_SOLUTION: string = [
  '534678912',
  '672195348',
  '198342567',
  '000000000',
  '000000000',
  '000000000',
  '000000000',
  '000000000',
  '000000000',
]
  .join('\n',);

/** Clue cells for the multi-solution puzzle, used to verify the single returned solution */
export const MULTI_CLUES: readonly (readonly number[])[] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2,],
  [6, 7, 2, 1, 9, 5, 3, 4, 8,],
  [1, 9, 8, 3, 4, 2, 5, 6, 7,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
];

//endregion Normal mode puzzles

//region --all mode puzzles: exact enumeration, many-solution, unsolvable

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
export const TWO_SOLUTION: string = [
  '534008912',
  '672195348',
  '198342567',
  '859001423',
  '426853791',
  '713924856',
  '961537284',
  '287419635',
  '345286179',
]
  .join('\n',);

/** Clue cells for the 2-solution puzzle, used to verify both solutions match */
export const TWO_SOLUTION_CLUES: readonly (readonly number[])[] = [
  [5, 3, 4, 0, 0, 8, 9, 1, 2,],
  [6, 7, 2, 1, 9, 5, 3, 4, 8,],
  [1, 9, 8, 3, 4, 2, 5, 6, 7,],
  [8, 5, 9, 0, 0, 1, 4, 2, 3,],
  [4, 2, 6, 8, 5, 3, 7, 9, 1,],
  [7, 1, 3, 9, 2, 4, 8, 5, 6,],
  [9, 6, 1, 5, 3, 7, 2, 8, 4,],
  [2, 8, 7, 4, 1, 9, 6, 3, 5,],
  [3, 4, 5, 2, 8, 6, 1, 7, 9,],
];

/** Expected number of solutions for the 2-solution puzzle */
export const EXPECTED_TWO_SOLUTIONS = 2;

/**
 * Many-solution puzzle for --all mode; first two bands (rows 0-5) given, last band empty.
 * 54 clues with 27 empty cells concentrated in the last 3 rows. Each column has exactly
 * 3 candidate values, producing a manageable number of solutions (estimated 10-50)
 * that --all mode must enumerate completely within the container timeout.
 *
 * Including this alongside the 2-solution puzzle in --all mode catches models that
 * implement normal mode without early exit: normal mode on the 3-row MULTI_SOLUTION
 * puzzle times out if it enumerates all solutions, while --all mode on this 6-row
 * puzzle completes because the solution count is bounded.
 */
export const MANY_SOLUTION: string = [
  '534678912',
  '672195348',
  '198342567',
  '859761423',
  '426853791',
  '713924856',
  '000000000',
  '000000000',
  '000000000',
]
  .join('\n',);

/** Clue cells for the many-solution puzzle, used to verify all enumerated solutions match */
export const MANY_SOLUTION_CLUES: readonly (readonly number[])[] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2,],
  [6, 7, 2, 1, 9, 5, 3, 4, 8,],
  [1, 9, 8, 3, 4, 2, 5, 6, 7,],
  [8, 5, 9, 7, 6, 1, 4, 2, 3,],
  [4, 2, 6, 8, 5, 3, 7, 9, 1,],
  [7, 1, 3, 9, 2, 4, 8, 5, 6,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
  [0, 0, 0, 0, 0, 0, 0, 0, 0,],
];

/** Minimum number of solutions expected for the many-solution puzzle */
export const MIN_MANY_SOLUTIONS = 2;

//endregion --all mode puzzles

//region Assembled inputs: stdin strings combining puzzles for each mode

/**
 * Stdin for normal mode: 4 puzzles separated by blank lines.
 * Order: solvable, unsolvable (box), unsolvable (column), multi-solution.
 */
export const NORMAL_INPUT: string =
  [SOLVABLE, UNSOLVABLE_BOX, UNSOLVABLE_COL, MULTI_SOLUTION,].join('\n\n',) + '\n';

/** Number of independent correctness checks in normal mode */
export const NORMAL_CHECKS = 4;

/**
 * Stdin for --all mode: 3 puzzles (2-solution + many-solution + unsolvable).
 * Tests exact enumeration, many-solution enumeration, and unsolvable rejection under --all.
 */
export const ALL_INPUT: string =
  [TWO_SOLUTION, MANY_SOLUTION, UNSOLVABLE_BOX,].join('\n\n',)
  + '\n';

/** Number of independent correctness checks in --all mode */
export const ALL_CHECKS = 3;

//endregion Assembled inputs
