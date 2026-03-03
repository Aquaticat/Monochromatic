/**
 * Sudoku probe output parsing.
 *
 * Splits raw container stdout into per-puzzle result sections. The container
 * output format uses `---` lines as puzzle separators and blank lines as
 * solution separators within a puzzle.
 */

/**
 * Splits combined output into per-puzzle result sections.
 * Puzzles are separated by a line matching one or more dashes (e.g. "---").
 * @param output - raw stdout from the container
 * @returns array of trimmed result sections, one per puzzle
 *
 * @example
 * ```ts
 * splitOutputSections('534678912\n...\n---\nUNSOLVABLE'); // ['534678912\n...', 'UNSOLVABLE']
 * ```
 */
export function splitOutputSections(output: string): string[] {
  return output.trim().split(/\n-+\n/).map((puzzleSection) => puzzleSection.trim());
}
