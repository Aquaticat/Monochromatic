// Over 100 lines due to TSDoc on six tightly-coupled grid functions sharing constants.
// Further splitting would separate functions that depend on GRID_SIZE and BOX_SIZE.
/**
 * Sudoku grid parsing and validation helpers.
 *
 * Operates on 9x9 number arrays representing sudoku grids. Validates structural
 * correctness (rows, columns, 3x3 boxes) and clue matching independently of
 * any specific puzzle instance.
 */

/**
 * Returns `s` with every ASCII whitespace character (space, tab, newline,
 * carriage return, form feed, vertical tab) removed; everything else
 * passes through verbatim.
 *
 * @param s - input string
 *
 * @returns `s` with whitespace stripped
 *
 * @example
 * ```ts
 * stripAllWhitespace('a b\tc'); // 'abc'
 * ```
 */
export function stripAllWhitespace(s: string,): string {
  /**
   * Non-whitespace chars in order; joined once at the end so the accumulator is never rebuilt per char (single linear pass: O(n) time, no recursion).
   */
  const kept: string[] = [];

  for (const c of s) {
    /**
     * Whether the char satisfies regex `\s`; whitespace is dropped, everything else is kept.
     */
    const ws = (c === ' ')
      || (c === '\t')
      || (c === '\n')
      || (c === '\r')
      || (c === '\f')
      || (c === '\v');
    if (!ws)
      kept.push(c,);
  }

  return kept.join('',);
}

/**
 * Returns true when every char of `line` is a space or tab; matches the
 * horizontal-whitespace gap between paragraph-separator newlines.
 *
 * @param line - candidate line
 *
 * @returns whether the line is whitespace-only or empty
 *
 * @example
 * ```ts
 * isBlankLine('   '); // true
 * isBlankLine('  x'); // false
 * ```
 */
function isBlankLine(line: string,): boolean {
  for (const c of line) {
    if ((c !== ' ') && (c !== '\t'))
      return false;
  }
  return true;
}

/**
 * Splits `s` on paragraph separators: a newline, optional horizontal
 * whitespace, then another newline.
 *
 * @param s - input text
 *
 * @returns paragraph blocks (separator chars dropped)
 *
 * @example
 * ```ts
 * splitOnBlankLines('a\nb\n\nc'); // ['a\nb', 'c']
 * ```
 */
export function splitOnBlankLines(s: string,): string[] {
  /**
   * Lines after a primary split on newline; blank-line groups become empty entries.
   */
  const lines = s.split('\n',);
  /**
   * Completed blocks in order; each is a run of consecutive non-blank lines joined by newline.
   */
  const blocks: string[] = [];
  /**
   * Lines since the last blank line; flushed into `blocks` and cleared on each blank line so the accumulator is never copied (O(n) total).
   */
  const current: string[] = [];

  for (const line of lines) {
    if (isBlankLine(line,)) {
      if (current.length
        > 0) {
        blocks.push(current.join('\n',),);
        current.length = 0;
      }
    }
    else {
      current.push(line,);
    }
  }

  if (current.length
    > 0)
    blocks.push(current.join('\n',),);

  return blocks;
}

/**
 * Standard sudoku grid dimension
 */
const GRID_SIZE = 9;

/**
 * Standard sudoku 3x3 box dimension
 */
const BOX_SIZE = 3;

/**
 * Column indices [0..8] for functional iteration over grid columns
 */
const COLUMN_INDICES = Array.from(
  { length: GRID_SIZE, },
  function indexFromOffset(
    _,
    idx,
  ): number {
    return idx;
  },
);

/**
 * Box origin coordinates for all 9 boxes.
 * Each entry is [topRow, leftCol] for one 3x3 box, enabling functional
 * iteration without classic for loops.
 */
const BOX_ORIGINS: readonly (readonly [
  number,
  number,
])[] = Array.from(
  { length: GRID_SIZE, },
  function boxOrigin(
    _,
    idx,
  ): readonly [
    number,
    number,
  ] {
    return [
      Math.floor(idx / BOX_SIZE,)
        * BOX_SIZE,
      (idx % BOX_SIZE) * BOX_SIZE,
    ] as const;
  },
);

/**
 * Parses a text block into a 9x9 grid of digits 1-9.
 * Strips whitespace between digits to tolerate models that add spaces.
 *
 * @param text - raw text block for one puzzle output
 *
 * @returns 9x9 number array, or empty array when parsing fails
 *
 * @example
 * ```ts
 * parseGrid('534678912\n672195348\n...');
 * ```
 */
export function parseGrid(text: string,): number[][] {
  /**
   * Non-empty trimmed lines from the text block
   */
  const lines = text
    .trim()
    .split('\n',)
    .map(function trimLine(line,): string {
      return line.trim();
    },)
    .filter(function nonEmpty(line,): boolean {
      return line.length
        > 0;
    },);
  if (lines.length
    !== GRID_SIZE)
    return [];
  /**
   * Parsed digit rows; an empty row marks a line that failed digit validation.
   */
  const grid = lines.map(function parseLine(line,): number[] {
    /**
     * Digits extracted by stripping whitespace and converting each character
     */
    // oxlint-disable-next-line unicorn/prefer-spread -- spreading a string triggers no-misused-spread; Array.from is correct for ASCII digit iteration
    const digits = Array
      .from(stripAllWhitespace(line,),)
      .map(Number,);
    return (digits.length
      === GRID_SIZE)
        && digits
      .every(function validDigit(digit,): boolean {
          return (digit >= 1) && (digit <= GRID_SIZE);
        },)
      ? digits
      : [];
  },);
  return grid.every(function isFullRow(row,): boolean {
      return row.length
        === GRID_SIZE;
    },)
    ? grid
    : [];
}

/**
 * Options for {@link extractColumn}.
 *
 * @example
 * ```ts
 * const options: ExtractColumnOptions = { grid, col: 0 };
 * ```
 */
type ExtractColumnOptions = {
  /**
   * 9x9 grid of digits
   */
  readonly grid: readonly (readonly number[])[];
  /**
   * Column index (0-8)
   */
  readonly col: number;
};

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
 * extractColumn({ grid, col: 0 }); // [5, 6, 1, 8, 4, 7, 9, 2, 3]
 * ```
 */
function extractColumn({
  grid,
  col,
}: ExtractColumnOptions,): number[] {
  return grid.map(function getCol(row,): number {
    return row[col]
      ?? 0;
  },);
}

/**
 * Options for {@link extractBox}.
 *
 * @example
 * ```ts
 * const options: ExtractBoxOptions = { grid, originRow: 0, originCol: 0 };
 * ```
 */
type ExtractBoxOptions = {
  /**
   * 9x9 grid of digits
   */
  readonly grid: readonly (readonly number[])[];
  /**
   * Top row of the box (0, 3, or 6)
   */
  readonly originRow: number;
  /**
   * Left column of the box (0, 3, or 6)
   */
  readonly originCol: number;
};

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
 * extractBox({ grid, originRow: 0, originCol: 0 }); // top-left box values
 * ```
 */
function extractBox({
  grid,
  originRow,
  originCol,
}: ExtractBoxOptions,): number[] {
  return Array.from(
    { length: GRID_SIZE, },
    function cellValue(
      _,
      idx,
    ): number {
      return grid[originRow + Math
        .floor(idx / BOX_SIZE,)]?.[originCol + (idx % BOX_SIZE)]
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
export function isValidSolution(grid: readonly (readonly number[])[],): boolean {
  /**
   * Checks whether nums contains exactly GRID_SIZE distinct values (1-9).
   *
   * @param nums - array of digits to validate
   *
   * @returns true when the set of digits has exactly GRID_SIZE unique values
   */
  function hasAllDigits(nums: readonly number[],): boolean {
    return new Set(nums,).size
      === GRID_SIZE;
  }

  // Rows
  if (!grid.every(function checkRow(row,): boolean {
    return hasAllDigits(row,);
  },)) {
    return false;
  }

  // Columns
  if (!COLUMN_INDICES.every(function checkCol(col,): boolean {
    return hasAllDigits(extractColumn({
      grid,
      col,
    },),);
  },)) {
    return false;
  }

  // 3x3 boxes
  return BOX_ORIGINS.every(function checkBox([originRow, originCol,],): boolean {
    return hasAllDigits(extractBox({
      grid,
      originRow,
      originCol,
    },),);
  },);
}

/**
 * Options for {@link matchesClues}.
 *
 * @example
 * ```ts
 * const options: MatchesCluesOptions = { grid: solvedGrid, clues: SOLVABLE_CLUES };
 * ```
 */
type MatchesCluesOptions = {
  /**
   * 9x9 solved grid
   */
  readonly grid: readonly (readonly number[])[];
  /**
   * 9x9 clue grid (0 = empty, non-zero = required digit)
   */
  readonly clues: readonly (readonly number[])[];
};

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
 * matchesClues({ grid: solvedGrid, clues: SOLVABLE_CLUES }); // true
 * ```
 */
export function matchesClues({
  grid,
  clues,
}: MatchesCluesOptions,): boolean {
  return clues.every(function checkRow(
    row,
    rowIndex,
  ): boolean {
    return row.every(function checkClue(
      clue,
      colIndex,
    ): boolean {
      return (clue === 0) || (clue === (grid[rowIndex]?.[colIndex]
        ?? (-1)));
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
export function gridToString(grid: readonly (readonly number[])[],): string {
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
  return splitOnBlankLines(section,)
    .map(function trimBlock(block,): string {
      return block.trim();
    },)
    .filter(function nonEmpty(block,): boolean {
      return block.length
        > 0;
    },);
}
