/**
 * Formatting helpers for inlay annotations.
 *
 * Converts inlay hints and diagnostics into display strings,
 * and provides severity ranking for color styling.
 */

import type {
  Diagnostic,
  InlayHint,
} from '../../../protocol.ts';

/**
 * Formats a single inlay hint as a display string.
 * Applies padding based on the hint's padding flags.
 *
 * @param hint - inlay hint from the language server
 *
 * @returns formatted label string
 *
 * @example
 * ```ts
 * const result = formatHintLabel({ hint: { position: { line: 5, character: 10 }, label: ": number", kind: 1 }, });
 * ```
 */
export function formatHintLabel({ hint, }: { readonly hint: InlayHint; },): string {
  /**
   * Leading whitespace requested by the hint metadata; empty string when no padding is requested.
   */
  const padLeft = hint.paddingLeft
    === true ? ' ' : '';
  /**
   * Trailing whitespace requested by the hint metadata; empty string when no padding is requested.
   */
  const padRight = hint.paddingRight
    === true ? ' ' : '';
  /**
   * Parameter hints (kind=2) have a trailing colon that adds noise.
   */
  const PARAMETER_KIND = 2;
  /**
   * Type hints (kind=1) carry a leading ` : ` prefix that duplicates the padding.
   */
  const TYPE_KIND = 1;
  /**
   * Leading `': '` prefix stripped from type hints so the duplicated padding is removed.
   */
  const TYPE_HINT_PREFIX = ': ';
  /**
   * Strips kind-specific decoration from the raw inlay label.
   *
   * Parameter hints carry a trailing `:`; type hints carry a leading `': '`.
   * Other kinds (return type, enum member, etc.) pass through untouched.
   *
   * @returns label ready for concatenation between the pad characters
   */
  function strippedLabel(): string {
    if (hint.kind
      === PARAMETER_KIND) {
      return hint.label
        .endsWith(':',)
        ? hint.label
          .slice(
          0,
          -1,
        )
        : hint.label;
    }
    if (hint.kind
      === TYPE_KIND) {
      return hint.label
        .startsWith(TYPE_HINT_PREFIX,)
        ? hint.label
          .slice(TYPE_HINT_PREFIX.length,)
        : hint.label;
    }
    return hint.label;
  }
  /**
   * Label after kind-specific decoration is removed.
   */
  const label = strippedLabel();
  return `${padLeft}${label}${padRight}`;
}

/**
 * Formats a single diagnostic as a display string.
 * Includes severity and source when available.
 *
 * @param diagnostic - diagnostic from the language server
 *
 * @returns formatted diagnostic string
 *
 * @example
 * ```ts
 * formatDiagnosticLabel({
 *   diagnostic: {
 *     severity: 'error',
 *     source: 'typescript',
 *     message: "Cannot find name 'x'",
 *     range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
 *   },
 * })
 * // =\> "error(typescript): Cannot find name 'x'"
 * ```
 */
export function formatDiagnosticLabel(
  { diagnostic, }: { readonly diagnostic: Diagnostic; },
): string {
  /**
   * Severity-with-source tag rendered ahead of the message; falls back to bare severity when the source is empty.
   */
  const prefix = diagnostic.source
    !== ''
    ? `${diagnostic.severity}(${diagnostic.source})`
    : diagnostic.severity;
  return `${prefix}: ${diagnostic.message}`;
}

/**
 * Maps severity names to priority values (lower is more severe).
 */
const SEVERITY_PRIORITY: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
};

/**
 * Highest priority value (least severe).
 */
const LOWEST_PRIORITY = 4;

/**
 * Finds the most severe diagnostic severity from a list.
 *
 * @param diagnostics - diagnostics on a single line
 *
 * @returns severity string of the worst diagnostic
 *
 * @example
 * ```ts
 * const result = findWorstSeverity({ diagnostics: [], });
 * ```
 */
export function findWorstSeverity(
  { diagnostics, }: { readonly diagnostics: readonly Diagnostic[]; },
): string {
  /**
   * Severity string of the worst diagnostic seen so far; empty until the first match.
   */
  let worst = '';
  /**
   * Priority value of the worst diagnostic so far; starts at the lowest so any seen severity wins.
   */
  let worstPriority = LOWEST_PRIORITY;

  for (const diag of diagnostics) {
    /**
     * Numeric priority for this diagnostic; unknown severities fall back to the lowest priority.
     */
    const priority = SEVERITY_PRIORITY[diag.severity]
      ?? LOWEST_PRIORITY;
    if (priority < worstPriority) {
      worstPriority = priority;
      worst = diag.severity;
    }
  }

  return worst;
}
