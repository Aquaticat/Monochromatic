/**
 * Filter pipeline for Bash tool output.
 *
 * `runFilter` is the entry-point function called by the per-plugin filter shim.
 * It reads stdin, applies all transformations, and writes filtered output to
 * stdout. On any error, it falls through and writes the original input
 * unchanged so tool output is never lost.
 *
 * @module
 */

import { text, } from 'node:stream/consumers';
import {
  collapseCwdPaths,
  collapseHomePaths,
  collapseRepeatedChars,
  flushRepeated,
  shouldStripLine,
  truncateLine,
} from './filter-transforms.ts';

/**
 * Applies all filter transformations to raw tool output.
 *
 * @param input - raw stdout/stderr text from the Bash tool
 *
 * @returns filtered text with boilerplate, long lines, duplicates, and trailing
 *   whitespace removed
 *
 * @example
 * ```ts
 * filterOutput('hello\nhello\nworld'); // 'hello (x2)\nworld'
 * ```
 */
function filterOutput(input: string,): string {
  return collapseLines(input.split('\n',),).join('\n',);
}

/**
 * Applies per-line transformations and collapses consecutive duplicates,
 * returning the resulting lines.
 *
 * Helper-function shape: encapsulates the mutable state machine
 * (`prevLine`, `repeatCount`) needed to detect and collapse runs of
 * identical lines without leaking those bindings to callers.
 *
 * @param lines - raw lines from the input, before transformations
 *
 * @returns processed lines with duplicates collapsed via `flushRepeated`
 *
 * @example
 * ```ts
 * const out = collapseLines(['hello', 'hello', 'world']);
 * ```
 */
function collapseLines(lines: string[],): string[] {
  const result: string[] = [];
  let prevLine = '';
  let repeatCount = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trimEnd();

    if (shouldStripLine(trimmed,))
      continue;

    const collapsed = collapseRepeatedChars(trimmed,);
    const relative = collapseCwdPaths(collapsed,);
    const shortened = collapseHomePaths(relative,);
    const processed = truncateLine(shortened,);

    if ((processed === prevLine) && (repeatCount > 0))
      repeatCount++;
    else {
      flushRepeated({
        result,
        line: prevLine,
        count: repeatCount,
      },);
      prevLine = processed;
      repeatCount = 1;
    }
  }

  flushRepeated({
    result,
    line: prevLine,
    count: repeatCount,
  },);

  return result;
}

/**
 * Entry-point for the filter script. Reads stdin to EOF, applies the filter
 * pipeline, and writes the result to stdout. On any failure, writes the
 * unfiltered stdin content as a fallthrough -- losing output is worse than
 * failing to filter.
 *
 * @example
 * ```ts
 * await runFilter();
 * ```
 */
async function runFilter(): Promise<void> {
  try {
    const input = await text(process.stdin,);
    const filtered = filterOutput(input,);
    process.stdout.write(filtered,);
  }
  catch {
    try {
      const fallback = await text(process.stdin,);
      process.stdout.write(fallback,);
    }
    catch {
      /* stdin already consumed or unavailable: nothing to pass through */
    }
  }
}

export {
  filterOutput,
  runFilter,
};
