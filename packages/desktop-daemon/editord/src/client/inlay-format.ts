/**
 * Formatting helpers for inlay annotations.
 *
 * Converts inlay hints and diagnostics into display strings,
 * and provides severity ranking for color styling.
 */

import type { Diagnostic, InlayHint, } from '../protocol.ts';

/** Separator between inlay hints and diagnostics on the same line. */
export const SECTION_SEPARATOR = '  \u2502  ';

/** Separator between multiple hints on the same line. */
export const HINT_SEPARATOR = '   ';

/** Separator between multiple diagnostics on the same line. */
export const DIAGNOSTIC_SEPARATOR = '   ';

/**
 * Formats a single inlay hint as a display string.
 * Applies padding based on the hint's padding flags.
 *
 * @param hint - inlay hint from the language server
 *
 * @returns formatted label string
 */
export function formatHintLabel({ hint, }: { hint: InlayHint }): string {
  const padLeft = hint.paddingLeft === true ? ' ' : '';
  const padRight = hint.paddingRight === true ? ' ' : '';
  /** Parameter hints (kind=2) have a trailing colon that adds noise. */
  const PARAMETER_KIND = 2;
  const label = hint.kind === PARAMETER_KIND
    ? hint.label.replace(/:$/, '',)
    : hint.label;
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
export function formatDiagnosticLabel({ diagnostic, }: { diagnostic: Diagnostic }): string {
  const prefix = diagnostic.source !== ''
    ? `${diagnostic.severity}(${diagnostic.source})`
    : diagnostic.severity;
  return `${prefix}: ${diagnostic.message}`;
}

/** Maps severity names to priority values (lower is more severe). */
const SEVERITY_PRIORITY: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
};

/** Highest priority value (least severe). */
const LOWEST_PRIORITY = 4;

/**
 * Finds the most severe diagnostic severity from a list.
 *
 * @param diagnostics - diagnostics on a single line
 *
 * @returns severity string of the worst diagnostic
 */
export function findWorstSeverity({ diagnostics, }: { diagnostics: Diagnostic[] }): string {
  let worst = '';
  let worstPriority = LOWEST_PRIORITY;

  for (const diag of diagnostics) {
    const priority = SEVERITY_PRIORITY[diag.severity] ?? LOWEST_PRIORITY;
    if (priority < worstPriority) {
      worstPriority = priority;
      worst = diag.severity;
    }
  }

  return worst;
}
