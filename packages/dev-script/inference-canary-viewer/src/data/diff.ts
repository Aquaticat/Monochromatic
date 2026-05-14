/**
 * Line-level diff computation using `git diff --no-index`.
 *
 * Points git directly at the on-disk artifact files in `canary-lint/`,
 * so no temp files are needed.
 */

import spawn from 'nano-spawn';

/** Single line in a diff result */
export type DiffLine = {
  readonly type: 'added' | 'removed' | 'unchanged';
  readonly content: string;
};

/**
 * Computes a line-level diff between two existing files using git.
 *
 * @param initialPath - absolute path to initial pass source file
 *
 * @param fixPath - absolute path to fix pass source file
 *
 * @returns array of diff lines
 *
 * @example
 * ```ts
 * const lines = await computeDiff({ initialPath: '/path/to/initial/canary.ts', fixPath: '/path/to/fix/canary.ts' });
 * // [{ type: 'removed', content: 'const x = 1;' }, { type: 'added', content: 'const x = 2;' }]
 * ```
 */
export async function computeDiff({
  initialPath,
  fixPath,
}: {
  initialPath: string;
  fixPath: string;
},): Promise<readonly DiffLine[]> {
  /**
   * git diff --no-index exits with 1 when files differ (not an error).
   * --unified=99999 requests enough context lines to include the entire file.
   */
  let stdout = '';
  try {
    /** Spawn result holding stdout on the success path; ignored on exit-1 (handled in catch). */
    const result = await spawn(
      'git',
      [
        'diff',
        '--no-index',
        '--unified=99999',
        '--no-color',
        initialPath,
        fixPath,
      ],
    );
    ({ stdout, } = result);
  }
  catch (error: unknown) {
    // Exit code 1 means files differ (expected behavior)
    if (typeof error === 'object' && error !== null && 'stdout' in error)
      stdout = String(error.stdout,);
  }

  return parseDiffOutput(stdout,);
}

/**
 * Parses unified diff output into typed diff lines.
 * Skips the diff header lines (everything before the first `@@` hunk marker).
 *
 * @param output - raw unified diff output from git
 *
 * @returns parsed diff lines
 */
function parseDiffOutput(output: string,): readonly DiffLine[] {
  /** Raw output split into lines so each can be classified against the unified-diff prefixes. */
  const lines = output.split('\n',);
  /** Accumulator that collects classified diff lines once the parser is inside a hunk. */
  const result: DiffLine[] = [];

  /** Whether we have passed the header and reached actual diff content */
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('@@',)) {
      inHunk = true;
      continue;
    }
    if (!inHunk)
      continue;

    if (line.startsWith('+',)) {
      result.push({
        type: 'added',
        content: line.slice(1,),
      },);
    }
    else if (line.startsWith('-',)) {
      result.push({
        type: 'removed',
        content: line.slice(1,),
      },);
    }
    else if (line.startsWith(' ',)) {
      result.push({
        type: 'unchanged',
        content: line.slice(1,),
      },);
    }
    // Skip "\ No newline at end of file" and empty trailing lines
  }

  return result;
}
