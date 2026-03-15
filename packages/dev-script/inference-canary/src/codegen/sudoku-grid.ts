// Over 100 lines due to TSDoc on six tightly-coupled grid functions sharing constants.
// Further splitting would separate functions that depend on GRID_SIZE and BOX_SIZE.
/**
 * Sudoku grid parsing and validation helpers.
 *
 * Operates on 9x9 number arrays representing sudoku grids. Validates structural
 * correctness (rows, columns, 3x3 boxes) and clue matching independently of
 * any specific puzzle instance.
 */

/** Standard sudoku grid dimension */
const GRID_SIZE = 9;

/** Standard sudoku 3x3 box dimension */
const BOX_SIZE = 3;

/** Column indices [0..8] for functional iteration over grid columns */
const COLUMN_INDICES = Array.from({ length: GRID_SIZE, },
  function indexFromOffset(_, idx,): number {
    return idx;
  },);

/**
 * Box origin coordinates for all 9 boxes.
 * Each entry is [topRow, leftCol] for one 3x3 box, enabling functional
 * iteration without classic for loops.
 */
const BOX_ORIGINS: readonly (readonly [number, number,])[] = Array.from(
  { length: GRID_SIZE, },
  function boxOrigin(_, idx,): readonly [number, number,] {
    return [Math.floor(idx / BOX_SIZE,) * BOX_SIZE,
      (idx % BOX_SIZE) * BOX_SIZE,] as const;
  },
);

/**
 * Parses a text block into a 9x9 grid of digits 1-9.
 * Strips whitespace between digits to tolerate models that add spaces.
 *
 * @param text - raw text block for one puzzle output
 *
 * @returns 9x9 number array, or undefined when parsing fails
 *
 * @example
 * ```ts
 * parseGrid('534678912\n672195348\n...');
 * ```
 */
export function parseGrid(text: string,): number[][] | undefined {
  /** Non-empty trimmed lines from the text block */
  const lines = text
    .trim()
    .split('\n',)
    .map(function trimLine(line,): string {
      return line.trim();
    },)
    .filter(function nonEmpty(line,): boolean {
      return line.length > 0;
    },);
  if (lines.length !== GRID_SIZE)
    return undefined;
  /** Parsed digit rows, undefined entries indicate parse failure */
  const grid = lines.map(function parseLine(line,): number[] | undefined {
    /** Digits extracted by stripping whitespace and converting each character */
    const digits = Array.from(line.replaceAll(/\s/g, '',),).map(Number,);
    return digits.length === GRID_SIZE
        && digits.every(function validDigit(digit,): boolean {
          return digit >= 1 && digit <= GRID_SIZE;
        },)
      ? digits
      : undefined;
  },);
  return grid.every(function isRow(row,): row is number[] {
      return row !== undefined;
    },)
    ? grid
    : undefined;
}

/**
 * Extracts all values from a single column of the grid.
 *
 * @param grid - 9x9 grid of digits
 *
 * @param col - column index (0-8)
 *
 * @returns array of 9 values from the specified column
 *
 * @example
 * ```ts
 * extractColumn(grid, 0); // [5, 6, 1, 8, 4, 7, 9, 2, 3]
 * ```
 */
function extractColumn(grid: number[][], col: number,): number[] {
  return grid.map(function getCol(row,): number {
    return row[col] ?? 0;
  },);
}

/**
 * Extracts all 9 values from a 3x3 box given its top-left corner.
 * Linearizes the box cells into a flat array using index arithmetic.
 *
 * @param grid - 9x9 grid of digits
 *
 * @param originRow - top row of the box (0, 3, or 6)
 *
 * @param originCol - left column of the box (0, 3, or 6)
 *
 * @returns array of 9 values from the specified box
 *
 * @example
 * ```ts
 * extractBox(grid, 0, 0); // top-left box values
 * ```
 */
function extractBox(grid: number[][], originRow: number, originCol: number,): number[] {
  return Array.from(
    { length: GRID_SIZE, },
    function cellValue(_, idx,): number {
      return grid[originRow + Math.floor(idx / BOX_SIZE,)]?.[originCol + (idx % BOX_SIZE)]
        ?? 0;
    },
  );
}

/**
 * Checks whether a 9x9 grid is a valid solved sudoku.
 * Validates row, column, and 3x3 box uniqueness.
 *
 * @param grid - 9x9 grid of digits 1-9
 *
 * @returns true when every row, column, and box contains digits 1-9 exactly once
 *
 * @example
 * ```ts
 * isValidSolution(solvedGrid); // true
 * ```
 */
export function isValidSolution(grid: number[][],): boolean {
  /** Checks whether nums contains exactly GRID_SIZE distinct values (1-9) */
  function hasAllDigits(nums: number[],): boolean {
    return new Set(nums,).size === GRID_SIZE;
  }

  // Rows
  if (!grid.every(hasAllDigits,))
    return false;

  // Columns
  if (!COLUMN_INDICES.every(function checkCol(col,): boolean {
    return hasAllDigits(extractColumn(grid, col,),);
  },)) {
    return false;
  }

  // 3x3 boxes
  return BOX_ORIGINS.every(function checkBox([originRow, originCol,],): boolean {
    return hasAllDigits(extractBox(grid, originRow, originCol,),);
  },);
}

/**
 * Verifies that a solved grid matches all non-zero clue cells from the original puzzle.
 *
 * @param grid - 9x9 solved grid
 *
 * @param clues - 9x9 clue grid (0 = empty, non-zero = required digit)
 *
 * @returns true when every clue cell matches the solution
 *
 * @example
 * ```ts
 * matchesClues(solvedGrid, SOLVABLE_CLUES); // true
 * ```
 */
export function matchesClues(grid: number[][],
  clues: readonly (readonly number[])[],): boolean
{
  return clues.every(function checkRow(row, rowIndex,): boolean {
    return row.every(function checkClue(clue, colIndex,): boolean {
      return clue === 0 || clue === (grid[rowIndex]?.[colIndex] ?? -1);
    },);
  },);
}

/**
 * Serializes a 9x9 grid into a canonical string for deduplication.
 * Each row becomes a 9-digit string joined by newlines.
 *
 * @param grid - 9x9 grid of digits 1-9
 *
 * @returns canonical grid string
 *
 * @example
 * ```ts
 * gridToString([[5,3,4,...], ...]); // '534...\n672...\n...'
 * ```
 */
export function gridToString(grid: number[][],): string {
  return grid
    .map(function joinRow(row,): string {
      return row.join('',);
    },)
    .join('\n',);
}

/**
 * Splits a single puzzle's result section into individual solution grids.
 * Within a puzzle result, solutions are separated by blank lines.
 *
 * @param section - trimmed result section for one puzzle
 *
 * @returns array of solution text blocks
 *
 * @example
 * ```ts
 * splitSolutions('534678912\n...\n\n534768912\n...'); // ['534678912\n...', '534768912\n...']
 * ```
 */
export function splitSolutions(section: string,): string[] {
  return section
    .split(/\n\s*\n/,)
    .map(function trimBlock(block,): string {
      return block.trim();
    },)
    .filter(function nonEmpty(block,): boolean {
      return block.length > 0;
    },);
}
