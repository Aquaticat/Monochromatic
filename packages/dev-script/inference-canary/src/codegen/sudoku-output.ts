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
  return splitOnDashLines(output.trim(),).map(function trimSection(puzzleSection,): string {
    return puzzleSection.trim();
  },);
}

/**
 * Splits `s` on lines that consist entirely of one or more `-` characters
 * (the separator the model is expected to emit between puzzles). Mirrors
 * `s.split(/\n-+\n/)`: a separator must be flanked by newlines on both
 * sides, and the body between newlines must be at least one `-`.
 *
 * @param s - trimmed multi-puzzle output
 *
 * @returns ordered list of inter-separator sections
 */
function splitOnDashLines(s: string,): string[] {
  /** Lines after a primary `\n` split; separator lines are detected by `isDashLine` below. */
  const lines = s.split('\n',);
  /**
   * Returns true when `line` is a non-empty run of only `-` characters.
   *
   * @param line - candidate line
   *
   * @returns whether the line satisfies `-+`
   */
  function isDashLine(line: string,): boolean {
    if (line.length === 0)
      return false;
    for (const c of line) {
      if (c !== '-')
        return false;
    }
    return true;
  }
  /**
   * Recursive walker that joins consecutive non-separator lines into a
   * section and flushes the section on every dash-only line.
   *
   * @param idx - cursor into `lines`
   *
   * @param section - lines accumulated since the last separator
   *
   * @param acc - completed sections so far
   *
   * @returns final section list
   */
  function walk({
    idx,
    section,
    acc,
  }: {
    idx: number;
    section: readonly string[];
    acc: readonly string[];
  },): string[] {
    if (idx >= lines.length) {
      return [
        ...acc,
        section.join('\n',),
      ];
    }
    /** Line at the cursor. */
    const line = lines[idx] ?? '';
    if (isDashLine(line,)) {
      return walk({
        idx: idx + 1,
        section: [],
        acc: [
          ...acc,
          section.join('\n',),
        ],
      },);
    }
    return walk({
      idx: idx + 1,
      section: [
        ...section,
        line,
      ],
      acc,
    },);
  }
  return walk({
    idx: 0,
    section: [],
    acc: [],
  },);
}
