import type { Diagnostic, } from './nvim-types.ts';

//region Dedup key: builds a string key for comparing diagnostics across sources

/**
 * Builds a deduplication key for a diagnostic.
 * Uses `lnum:col:code` when code is present (most reliable; same rule at same location).
 * Falls back to `lnum:col:message` when code is absent.
 *
 * @param diagnostic - Diagnostic to build a key for.
 *
 * @returns String key suitable for Set/Map membership testing.
 *
 * @example
 * ```ts
 * dedupKey({ lnum: 10, col: 5, code: "no-unused-vars", message: "x", severity: "ERROR", end_lnum: 10, end_col: 5, source: "oxlint" });
 * // => "10:5:no-unused-vars"
 * ```
 */
export function dedupKey(diagnostic: Diagnostic,): string {
  if (diagnostic.code
    !== null)
    return `${diagnostic.lnum}:${diagnostic.col}:${diagnostic.code}`;
  return `${diagnostic.lnum}:${diagnostic.col}:${diagnostic.message}`;
}

//endregion Dedup key

//region Public API: merge and deduplicate diagnostics

/**
 * Removes duplicate diagnostics from a single array.
 * Keeps the first occurrence of each unique diagnostic (by dedup key).
 * Useful when merging diagnostics from multiple Neovim instances for the same file.
 *
 * @param diagnostics - Array that may contain duplicates.
 *
 * @returns New array with duplicates removed, preserving order of first occurrences.
 *
 * @example
 * ```ts
 * const unique = uniqueDiagnostics([diagA, diagACopy, diagB]);
 * // => [diagA, diagB]
 * ```
 */
export function uniqueDiagnostics(diagnostics: readonly Diagnostic[],): Diagnostic[] {
  /**
   * Keys observed during the walk; lets the filter drop every duplicate after the first.
   */
  const seen = new Set<string>();
  return diagnostics.filter(function isFirstOccurrence(diagnostic,) {
    /**
     * Identity key for this diagnostic; collisions mean the entry is a duplicate of an earlier occurrence.
     */
    const key = dedupKey(diagnostic,);
    if (seen.has(key,))
      return false;
    seen.add(key,);
    return true;
  },);
}

/**
 * Merges editor diagnostics with CLI lint diagnostics, removing duplicates.
 * Editor diagnostics take priority (richer end position info from LSP).
 * Lint-only diagnostics are appended after all editor diagnostics.
 *
 * @param editor - Diagnostics from the editor (LSP).
 *
 * @param lint - Diagnostics from the CLI linter.
 *
 * @returns Merged array with duplicates removed.
 *
 * @example
 * ```ts
 * const merged = dedupDiagnostics({
 *
 *   editor: [{ severity: "ERROR", lnum: 10, col: 5, end_lnum: 10, end_col: 15, message: "Type mismatch", source: "typescript", code: 2345 }],
 *   lint: [{ severity: "ERROR", lnum: 10, col: 5, end_lnum: 10, end_col: 5, message: "Type mismatch", source: "oxlint", code: 2345 }],
 * });
 * // => editor diagnostic kept, lint duplicate removed
 * ```
 */
export function dedupDiagnostics({
  editor,
  lint,
}: {
  editor: readonly Diagnostic[];
  lint: readonly Diagnostic[];
},): Diagnostic[] {
  /**
   * Dedup keys for editor diagnostics; precomputed so each lint entry can be matched in O(1).
   */
  const editorKeys = new Set(editor.map(function buildKey(d,) {
    return dedupKey(d,);
  },),);
  /**
   * Lint diagnostics that have no editor counterpart; appended after editor entries to keep editor positions authoritative.
   */
  const lintOnly = lint.filter(function isNotDuplicate(diagnostic,) {
    return !editorKeys.has(dedupKey(diagnostic,),);
  },);
  return [
    ...editor,
    ...lintOnly,
  ];
}

//endregion Public API
