/**
 * Suppression of known false-positive oxlint diagnostics for `task-oxlint`.
 *
 * Mirrors the source-filtering shape of {@link file://./tsc-filter.ts}: a
 * hardcoded, documented list of known false-positive signatures, a pure
 * filter that drops matching diagnostic blocks, and an exit-code rule of
 * "fail only when non-suppressed diagnostics remain".
 *
 * Unlike `tsc`, oxlint emits multi-line diagnostic blocks separated by blank
 * lines and a trailing `Found N warnings and M errors.` summary, so this
 * module segments by block (not by line) and recomputes the summary counts.
 *
 * Each suppression must name a genuine false positive the linter cannot be
 * told to ignore by configuration. See {@link OXLINT_SUPPRESSIONS}.
 *
 * @module
 */

import {
  extractRuleName,
  NO_RULE,
  stripAnsi,
} from './oxlint-augment.ts';

//region Suppression registry

/**
 * One known false-positive signature.
 *
 * A diagnostic block is suppressed when its rule equals {@link OxlintSuppression.rule},
 * its block text contains {@link OxlintSuppression.snippetIncludes}, and
 * (when set) its block text contains {@link OxlintSuppression.pathIncludes}.
 * All conditions must hold, so a real violation that merely shares a rule is
 * not dropped.
 */
export type OxlintSuppression = {
  /**
   * Exact oxlint rule name without plugin prefix, for example `no-explicit-any`.
   */
  readonly rule: string;
  /**
   * Substring that must appear in the diagnostic block (header, source snippet, or both).
   *
   * Plain `String.prototype.includes` matching, so keep it specific: a broad
   * token (e.g. `'string'`) would silently suppress unrelated diagnostics, and
   * `'LegacyOpaque'` also matches `'LegacyOpaqueHelper'`.
   */
  readonly snippetIncludes: string;
  /**
   * Optional substring that must appear in the block, typically a file path fragment to scope the match.
   */
  readonly pathIncludes?: string;
  /**
   * Why this diagnostic is a false positive the linter cannot be configured to ignore.
   */
  readonly reason: string;
};

/**
 * Hardcoded known false-positive signatures, documented like
 * `tsc-filter`'s suppressed sources.
 *
 * @example
 * ```ts
 * filterOxlintOutput({ output, suppressions: OXLINT_SUPPRESSIONS });
 * ```
 */
export const OXLINT_SUPPRESSIONS: readonly OxlintSuppression[] = [];

//endregion Suppression registry

//region Diagnostic block detection

/**
 * Tests whether a line is blank, the boundary between diagnostic blocks.
 *
 * @param line - single line of oxlint output, possibly ANSI-colored
 *
 * @returns whether the line is empty after ANSI stripping and trimming
 *
 * @example
 * ```ts
 * isBlankLine('  [0m '); // true
 * isBlankLine(' 253 | code');  // false
 * ```
 */
function isBlankLine(line: string,): boolean {
  return stripAnsi(line,)
    .trim()
    === '';
}

/**
 * Sentinel returned by {@link classifyHeader} when a line is not a diagnostic header.
 *
 * A unique `Symbol` keeps "not a header" out of a nullish union (banned by
 * `no-nullish-union`); callers narrow with `=== NOT_DIAGNOSTIC_HEADER`.
 */
export const NOT_DIAGNOSTIC_HEADER: unique symbol = Symbol('line lacks oxlint diagnostic header',);

/**
 * Classifies an oxlint diagnostic header line.
 *
 * Header lines open with `!` (warning) or `x` (error) after optional
 * whitespace, followed by `plugin(rule):`, parsed via {@link extractRuleName}.
 * Non-header lines return {@link NOT_DIAGNOSTIC_HEADER}.
 *
 * @param line - single line of oxlint output, possibly ANSI-colored
 *
 * @returns rule name and severity, or {@link NOT_DIAGNOSTIC_HEADER} when the line is not a header
 *
 * @example
 * ```ts
 * classifyHeader('  ! typescript(no-explicit-any): ...');
 * // { rule: 'no-explicit-any', severity: 'warning' }
 * classifyHeader(' 253 | code');
 * // NOT_DIAGNOSTIC_HEADER
 * ```
 */
export function classifyHeader(line: string,): {
  readonly rule: string;
  readonly severity: 'warning' | 'error';
} | typeof NOT_DIAGNOSTIC_HEADER {
  /**
   * Rule name when `line` is a diagnostic header; a missing name rejects non-headers before severity is read.
   */
  const rule = extractRuleName(line,);
  if (rule === NO_RULE)
    return NOT_DIAGNOSTIC_HEADER;

  /**
   * ANSI-stripped, left-trimmed copy whose first char is the `!`/`x` severity marker.
   */
  const marker = stripAnsi(line,)
    .trimStart();
  return {
    rule,
    severity: marker.startsWith('x',) ? 'error' : 'warning',
  };
}

/**
 * Returns the exclusive end index of the diagnostic block starting at `start`.
 *
 * A block is the run of consecutive non-blank lines beginning at a header;
 * the first blank line (or end of input) terminates it.
 *
 * @param lines - all output lines
 *
 * @param start - index of the block's header line
 *
 * @returns exclusive end index (first blank line at/after `start`, or `lines.length`)
 *
 * @example
 * ```ts
 * blockEndIndex({ lines: ['! a(b): c', ' 1 | x', '', 'next'], start: 0 }); // 2
 * ```
 */
function blockEndIndex({
  lines,
  start,
}: {
  readonly lines: readonly string[];
  readonly start: number;
},): number {
  for (let cursorIndex = start; cursorIndex < lines.length; cursorIndex += 1) {
    if (isBlankLine(lines[cursorIndex] ?? '',))
      return cursorIndex;
  }
  return lines.length;
}

/**
 * Tests whether a diagnostic block matches any suppression.
 *
 * Block text is compared after {@link stripAnsi} so snippet and path
 * substrings match the visible source rather than raw escape codes.
 *
 * @param block - block lines (header through its last context line)
 *
 * @param rule - rule name parsed from the block header
 *
 * @param suppressions - active suppression registry
 *
 * @returns whether a suppression matches, so the block should be dropped
 *
 * @example
 * ```ts
 * blockIsSuppressed({ block: ['! t(no-explicit-any): m', ' 1 | type LegacyOpaque = any'], rule: 'no-explicit-any', suppressions: OXLINT_SUPPRESSIONS });
 * // true
 * ```
 */
function blockIsSuppressed({
  block,
  rule,
  suppressions,
}: {
  readonly block: readonly string[];
  readonly rule: string;
  readonly suppressions: readonly OxlintSuppression[];
},): boolean {
  /**
   * ANSI-stripped block text, so snippet and path substrings match the visible source.
   */
  const blockText = block
    .map(function strip(line,) {
      return stripAnsi(line,);
    },)
    .join('\n',);

  return suppressions.some(function blockMatches(suppression,) {
    return (suppression.rule === rule)
      && blockText.includes(suppression.snippetIncludes,)
      && ((suppression.pathIncludes === undefined)
        || blockText.includes(suppression.pathIncludes,));
  },);
}

//endregion Diagnostic block detection

//region Summary recomputation

/**
 * Literal prefix of oxlint's diagnostic summary line.
 */
const SUMMARY_PREFIX = 'Found ';

/**
 * Tests whether a line is oxlint's `Found N warnings and M errors.` summary.
 *
 * @param line - single line of oxlint output
 *
 * @returns whether the line is the diagnostic summary
 *
 * @example
 * ```ts
 * isSummaryLine('Found 11 warnings and 0 errors.'); // true
 * isSummaryLine('Finished in 5ms ...');             // false
 * ```
 */
function isSummaryLine(line: string,): boolean {
  /**
   * ANSI-stripped, left-trimmed copy; the summary always opens with `Found ` then counts.
   */
  const text = stripAnsi(line,)
    .trimStart();
  return text.startsWith(SUMMARY_PREFIX,)
    && text.includes('warning',)
    && text.includes('error',);
}

/**
 * Renders a count with the matching singular/plural noun.
 *
 * @param count - non-negative diagnostic count
 *
 * @param noun - singular noun (`warning` or `error`)
 *
 * @returns `"1 warning"` / `"0 warnings"` style fragment
 *
 * @example
 * ```ts
 * pluralize({ count: 1, noun: 'warning' }); // '1 warning'
 * pluralize({ count: 0, noun: 'error' });   // '0 errors'
 * ```
 */
function pluralize({
  count,
  noun,
}: {
  readonly count: number;
  readonly noun: string;
},): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Rewrites the summary line to reflect counts after suppression.
 *
 * Regenerates the line from the post-suppression totals rather than parsing
 * the original numbers, so the displayed summary always matches what passed
 * the filter. Identifies the line to rewrite with {@link isSummaryLine} and
 * formats each count with {@link pluralize}. Clamps at zero defensively.
 *
 * @param lines - kept output lines (blocks already filtered)
 *
 * @param remainingWarnings - warning blocks left after suppression
 *
 * @param remainingErrors - error blocks left after suppression
 *
 * @returns lines with the summary line regenerated when present
 *
 * @example
 * ```ts
 * rewriteSummary({ lines: ['Found 1 warnings and 0 errors.'], remainingWarnings: 0, remainingErrors: 0 });
 * // ['Found 0 warnings and 0 errors.']
 * ```
 */
function rewriteSummary({
  lines,
  remainingWarnings,
  remainingErrors,
}: {
  readonly lines: readonly string[];
  readonly remainingWarnings: number;
  readonly remainingErrors: number;
},): string[] {
  return lines.map(function adjust(line,) {
    if (!isSummaryLine(line,))
      return line;
    return `${SUMMARY_PREFIX}${
      pluralize({
        count: Math.max(
          remainingWarnings,
          0,
        ),
        noun: 'warning',
      },)
    } and ${
      pluralize({
        count: Math.max(
          remainingErrors,
          0,
        ),
        noun: 'error',
      },)
    }.`;
  },);
}

//endregion Summary recomputation

//region Output filtering

/**
 * Result of filtering oxlint output through the suppression registry.
 */
export type OxlintFilterResult = {
  /**
   * Output with suppressed diagnostic blocks removed and the summary recomputed.
   */
  readonly filtered: string;
  /**
   * Count of suppressed warning blocks.
   */
  readonly suppressedWarnings: number;
  /**
   * Count of suppressed error blocks.
   */
  readonly suppressedErrors: number;
  /**
   * Whether any non-suppressed diagnostic block remains (drives the wrapper's exit code).
   */
  readonly hasRemainingDiagnostics: boolean;
};

/**
 * Filters oxlint output, dropping diagnostic blocks that match a suppression.
 *
 * Segments the output into blank-line-delimited blocks using
 * {@link classifyHeader} and {@link blockEndIndex}, drops each block (and
 * its trailing blank separator) that {@link blockIsSuppressed} matches
 * against {@link OXLINT_SUPPRESSIONS}, and recomputes the
 * `Found N warnings and M errors.` summary via {@link rewriteSummary}. A
 * diagnostic block must match a suppression on rule and snippet (and
 * optional path) to be dropped, so real violations are preserved.
 *
 * @param output - raw oxlint stdout
 *
 * @param suppressions - suppression registry (defaults to {@link OXLINT_SUPPRESSIONS})
 *
 * @returns filtered output, suppressed counts, and whether real diagnostics remain
 *
 * @example
 * ```ts
 * const { filtered, hasRemainingDiagnostics } = filterOxlintOutput({ output });
 * if (!hasRemainingDiagnostics) process.exitCode = 0;
 * ```
 */
export function filterOxlintOutput({
  output,
  suppressions = OXLINT_SUPPRESSIONS,
}: {
  readonly output: string;
  readonly suppressions?: readonly OxlintSuppression[];
},): OxlintFilterResult {
  if (output.length
    === 0) {
    return {
      filtered: '',
      suppressedWarnings: 0,
      suppressedErrors: 0,
      hasRemainingDiagnostics: false,
    };
  }

  /**
   * Source split per line so each block's header and context can be classified individually.
   */
  const lines = output.split('\n',);
  /**
   * Lines retained after filtering, before the summary is recomputed.
   */
  const kept: string[] = [];
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- multi-statement state machine: four counters are mutated across the block scan with side effects on `kept`. */
  /**
   * Suppressed warning-block tally, fed into the recomputed summary.
   */
  let suppressedWarnings = 0;
  /**
   * Suppressed error-block tally, fed into the recomputed summary.
   */
  let suppressedErrors = 0;
  /**
   * Surviving warning-block tally, used to regenerate the summary count.
   */
  let remainingWarnings = 0;
  /**
   * Surviving error-block tally, used to regenerate the summary count.
   */
  let remainingErrors = 0;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  // Index loop: `idx` jumps by whole blocks when one is dropped, so the stride is variable.
  for (let cursorIndex = 0; cursorIndex < lines.length;) {
    /**
     * Current line; only a header opens a diagnostic block.
     */
    const line = lines[cursorIndex] ?? '';
    /**
     * Header classification, or the sentinel for blank/context/summary lines that pass through unchanged.
     */
    const header = classifyHeader(line,);
    if (header === NOT_DIAGNOSTIC_HEADER) {
      kept.push(line,);
      cursorIndex += 1;
      continue;
    }

    /**
     * Exclusive end of this diagnostic block (first blank line or EOF).
     */
    const end = blockEndIndex({
      lines,
      start: cursorIndex,
    },);
    /**
     * This block's lines, header through last context line.
     */
    const block = lines.slice(
      cursorIndex,
      end,
    );

    if (!blockIsSuppressed({
      block,
      rule: header.rule,
      suppressions,
    },)) {
      if (header.severity === 'error')
        remainingErrors += 1;
      else
        remainingWarnings += 1;
      for (const blockLine of block)
        kept.push(blockLine,);
      cursorIndex = end;
      continue;
    }

    if (header.severity === 'error')
      suppressedErrors += 1;
    else
      suppressedWarnings += 1;
    // Drop the block and its trailing blank separator so no orphan blank remains.
    cursorIndex = (isBlankLine(lines[end] ?? 'x',)) ? end + 1 : end;
  }

  return {
    filtered: rewriteSummary({
      lines: kept,
      remainingWarnings,
      remainingErrors,
    },)
      .join('\n',),
    suppressedWarnings,
    suppressedErrors,
    hasRemainingDiagnostics: (remainingWarnings + remainingErrors) > 0,
  };
}

//endregion Output filtering

//region Exit-code decision

/**
 * oxlint's exit code when a run failed only because lint diagnostics were
 * found, as opposed to a config error, panic, or crash.
 *
 * Verified by running `oxlint --type-aware`: a lint-violation run exits `1`
 * with empty stderr (a missing-config error also exits `1`, but its message is
 * not a parseable diagnostic block, so nothing is suppressed and the failure
 * propagates through the `totalSuppressed === 0` guard). Crashes use other
 * codes or write to stderr, which {@link shouldForceSuccess} rejects.
 */
export const OXLINT_DIAGNOSTICS_EXIT_CODE = 1;

/**
 * Decides whether the wrapper may convert oxlint's non-zero exit into success.
 *
 * Forces success only when the failure was caused solely by diagnostics the
 * suppression registry dropped: at least one block was suppressed, none
 * survived, oxlint used its ordinary diagnostics exit code, and stderr was
 * empty. A config error or panic that merely coincides with a suppressible
 * block (a non-{@link OXLINT_DIAGNOSTICS_EXIT_CODE} exit or any stderr output)
 * keeps the failure, so a real fault is never hidden behind a suppressed false
 * positive.
 *
 * @param hasRemainingDiagnostics - whether any non-suppressed block survived filtering
 *
 * @param totalSuppressed - count of diagnostic blocks dropped this run
 *
 * @param exitCode - oxlint's exit code; callers guard the absent case (no code reported is never a forced success)
 *
 * @param stderr - oxlint's captured stderr, empty string when none
 *
 * @returns whether the wrapper should exit `0` despite oxlint's non-zero exit
 *
 * @example
 * ```ts
 * shouldForceSuccess({ hasRemainingDiagnostics: false, totalSuppressed: 1, exitCode: 1, stderr: '' }); // true
 * shouldForceSuccess({ hasRemainingDiagnostics: false, totalSuppressed: 1, exitCode: 2, stderr: 'fatal' }); // false
 * ```
 */
export function shouldForceSuccess({
  hasRemainingDiagnostics,
  totalSuppressed,
  exitCode,
  stderr,
}: {
  readonly hasRemainingDiagnostics: boolean;
  readonly totalSuppressed: number;
  readonly exitCode: number;
  readonly stderr: string;
},): boolean {
  return (!hasRemainingDiagnostics)
    && (totalSuppressed > 0)
    && (exitCode === OXLINT_DIAGNOSTICS_EXIT_CODE)
    && (stderr.trim()
      === '');
}

//endregion Exit-code decision
