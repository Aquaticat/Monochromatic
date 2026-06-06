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
 *
 * @param output - raw stdout from the container
 *
 * @returns array of trimmed result sections, one per puzzle
 *
 * @example
 * ```ts
 * splitOutputSections('534678912\n...\n---\nUNSOLVABLE'); // ['534678912\n...', 'UNSOLVABLE']
 * ```
 */
export function splitOutputSections(output: string,): string[] {
  return splitOnDashLines(output.trim(),)
    .map(
    function trimSection(puzzleSection,): string {
      return puzzleSection.trim();
    },
  );
}

/**
 * Returns true when `line` is a non-empty run of only `-` characters
 * (the inter-puzzle separator shape the model is expected to emit).
 *
 * @param line - candidate line
 *
 * @returns whether the line consists solely of one or more `-`
 *
 * @example
 * ```ts
 * isDashLine('---'); // true
 * isDashLine('-x-'); // false
 * isDashLine('');    // false
 * ```
 */
function isDashLine(line: string,): boolean {
  if (line.length
    === 0)
    return false;
  for (const c of line) {
    if (c !== '-')
      return false;
  }
  return true;
}

/**
 * Splits `s` on lines consisting entirely of one or more `-` characters
 * (the separator the model is expected to emit between puzzles). A
 * separator must be flanked by newlines on both sides.
 *
 * @param s - trimmed multi-puzzle output
 *
 * @returns ordered list of inter-separator sections
 *
 * @example
 * ```ts
 * splitOnDashLines('a\n---\nb'); // ['a', 'b']
 * ```
 */
export function splitOnDashLines(s: string,): string[] {
  /**
   * Lines after a primary newline split; separator lines are detected by `isDashLine`.
   */
  const lines = s.split('\n',);
  /**
   * Completed sections in order; a separator (and the final line) always flushes one, even when empty, so consecutive and edge separators yield empty sections.
   */
  const sections: string[] = [];
  /**
   * Lines since the last separator; flushed into `sections` and cleared on each separator so the accumulator is never copied (O(n) total).
   */
  const current: string[] = [];

  for (const line of lines) {
    if (isDashLine(line,)) {
      sections.push(current.join('\n',),);
      current.length = 0;
    }
    else {
      current.push(line,);
    }
  }

  sections.push(current.join('\n',),);

  return sections;
}
