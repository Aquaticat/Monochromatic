/**
 * Sudoku grid parsing and validation helpers for the sudoku-solver probe.
 *
 * Shared by both the normal-mode and --all-mode verifiers. Validates structural
 * correctness (rows, columns, 3x3 boxes) and clue matching independently of
 * any specific puzzle instance.
 */

/** Standard sudoku grid dimension */
const GRID_SIZE = 9;

/** Standard sudoku 3x3 box dimension */
const BOX_SIZE = 3;

/**
 * Parses a text block into a 9x9 grid of digits 1-9.
 * Strips whitespace between digits to tolerate models that add spaces.
 * @param text - raw text block for one puzzle output
 * @returns 9x9 number array, or undefined when parsing fails
 *
 * @example
 * ```ts
 * parseGrid('534678912\n672195348\n...');
 * ```
 */
export function parseGrid(text: string): number[][] | undefined {
  const lines = text.trim().split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length !== GRID_SIZE) return undefined;
  const grid = lines.map((line) => {
    const digits = [...line.replace(/\s/g, '')].map(Number);
    return digits.length === GRID_SIZE && digits.every((digit) => digit >= 1 && digit <= GRID_SIZE)
      ? digits
      : undefined;
  });
  return grid.every((row): row is number[] => row !== undefined)
    ? (grid as number[][])
    : undefined;
}

/**
 * Checks whether a 9x9 grid is a valid solved sudoku.
 * Validates row, column, and 3x3 box uniqueness.
 * @param grid - 9x9 grid of digits 1-9
 * @returns true when every row, column, and box contains digits 1-9 exactly once
 *
 * @example
 * ```ts
 * isValidSolution(solvedGrid); // true
 * ```
 */
export function isValidSolution(grid: number[][]): boolean {
  /** Checks whether nums contains exactly GRID_SIZE distinct values */
  const hasAllDigits = (nums: number[]): boolean => new Set(nums).size === GRID_SIZE;

  // Rows
  if (!grid.every(hasAllDigits)) return false;

  // Columns
  for (let col = 0; col < GRID_SIZE; col++) {
    if (!hasAllDigits(grid.map((row) => row[col] ?? 0))) return false;
  }

  // 3x3 boxes
  for (let boxRow = 0; boxRow < GRID_SIZE; boxRow += BOX_SIZE) {
    for (let boxCol = 0; boxCol < GRID_SIZE; boxCol += BOX_SIZE) {
      const cells: number[] = [];
      for (let row = boxRow; row < boxRow + BOX_SIZE; row++) {
        for (let col = boxCol; col < boxCol + BOX_SIZE; col++) {
          cells.push(grid[row]?.[col] ?? 0);
        }
      }
      if (!hasAllDigits(cells)) return false;
    }
  }

  return true;
}

/**
 * Verifies that a solved grid matches all non-zero clue cells from the original puzzle.
 * @param grid - 9x9 solved grid
 * @param clues - 9x9 clue grid (0 = empty, non-zero = required digit)
 * @returns true when every clue cell matches the solution
 *
 * @example
 * ```ts
 * matchesClues(solvedGrid, SOLVABLE_CLUES); // true
 * ```
 */
export function matchesClues(grid: number[][], clues: readonly (readonly number[])[]): boolean {
  return clues.every((row, rowIndex) =>
    row.every((clue, colIndex) => clue === 0 || clue === (grid[rowIndex]?.[colIndex] ?? -1)));
}

/**
 * Splits combined output into per-puzzle result sections.
 * Puzzles are separated by a line matching one or more dashes (e.g. "---").
 * @param output - raw stdout from the container
 * @returns array of trimmed result sections, one per puzzle
 *
 * @example
 * ```ts
 * splitPuzzleSections('534678912\n...\n---\nUNSOLVABLE'); // ['534678912\n...', 'UNSOLVABLE']
 * ```
 */
export function splitPuzzleSections(output: string): string[] {
  return output.trim().split(/\n-+\n/).map((section) => section.trim());
}

/**
 * Splits a single puzzle's result section into individual solution grids.
 * Within a puzzle result, solutions are separated by blank lines.
 * @param section - trimmed result section for one puzzle
 * @returns array of solution text blocks
 *
 * @example
 * ```ts
 * splitSolutions('534678912\n...\n\n534768912\n...'); // ['534678912\n...', '534768912\n...']
 * ```
 */
export function splitSolutions(section: string): string[] {
  return section.split(/\n\s*\n/).map((block) => block.trim()).filter((block) => block.length > 0);
}

/**
 * Serializes a 9x9 grid into a canonical string for deduplication.
 * Each row becomes a 9-digit string joined by newlines.
 * @param grid - 9x9 grid of digits 1-9
 * @returns canonical grid string
 *
 * @example
 * ```ts
 * gridToString([[5,3,4,...], ...]); // '534...\n672...\n...'
 * ```
 */
export function gridToString(grid: number[][]): string {
  return grid.map((row) => row.join('')).join('\n');
}
