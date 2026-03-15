#!/usr/bin/env bun

/**
 * Stdin filter that strips wasteful patterns from Bash tool output before the model sees it.
 *
 * Runs inside the sandbox as the right side of a pipe.
 * On any error, passes through the original input unchanged to avoid breaking tool output.
 *
 * Transformations applied (ranked by token savings):
 * - Git commit/push/pull boilerplate (`create mode`, progress counters)
 * - Long line truncation (>500 chars, catches minified JS)
 * - Consecutive duplicate line collapsing (3+ identical lines → `line (xN)`)
 * - Repeated character collapsing (`====...====` → `=== (x44)`)
 * - Working directory path collapsing (`/var/home/user/project/...` → `...`)
 * - Home directory path collapsing (`/var/home/user/...` → `~/...`)
 * - Trailing whitespace removal
 *
 * @example
 * ```bash
 * git commit -m "feat: add feature" 2>&1 | bun filter.ts
 * ```
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

//region Filter logic

/**
 * Applies all filter transformations to raw tool output.
 *
 * @param input - Raw stdout/stderr text from the Bash tool.
 *
 * @returns Filtered text with boilerplate, long lines, duplicates, and trailing whitespace removed.
 */
function filterOutput(input: string,): string {
  const lines = input.split('\n',);
  const result: string[] = [];

  let prevLine = '';
  let repeatCount = 0;

  for (const rawLine of lines) {
    /** Line with trailing whitespace removed. */
    const trimmed = rawLine.trimEnd();

    if (shouldStripLine(trimmed,))
      continue;

    /** Line after collapsing repeated decorative characters. */
    const collapsed = collapseRepeatedChars(trimmed,);

    /** Line after stripping the working directory prefix from absolute paths. */
    const relative = collapseCwdPaths(collapsed,);

    /** Line after replacing home directory paths with `~`. */
    const shortened = collapseHomePaths(relative,);

    /** Line after length truncation. */
    const processed = truncateLine(shortened,);

    if (processed === prevLine && repeatCount > 0)
      repeatCount++;
    else {
      flushRepeated({ result, line: prevLine, count: repeatCount, },);
      prevLine = processed;
      repeatCount = 1;
    }
  }

  flushRepeated({ result, line: prevLine, count: repeatCount, },);

  return result.join('\n',);
}

//endregion

//region Main

try {
  /** Raw text read from stdin (piped from the Bash tool command). */
  const input = await text(process.stdin,);

  /** Filtered output with waste patterns removed. */
  const filtered = filterOutput(input,);

  process.stdout.write(filtered,);
}
catch {
  /**
   * On any error, read and pass through whatever we can.
   * Losing output is worse than failing to filter.
   */
  try {
    /** Unfiltered stdin content passed through as-is on error. */
    const fallback = await text(process.stdin,);
    process.stdout.write(fallback,);
  }
  catch {
    /* stdin already consumed or unavailable -- nothing to pass through */
  }
}

//endregion
