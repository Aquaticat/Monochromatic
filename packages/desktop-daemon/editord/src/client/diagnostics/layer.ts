/**
 * Diagnostic highlight layer for the editor.
 *
 * Applies wavy underlines to text ranges using the CSS Custom Highlight API.
 * Four severity levels are supported: error, warning, info, and hint.
 * Each severity maps to a separate highlight name (`diag-error`, etc.)
 * so they can be independently styled in CSS.
 */

import type { Diagnostic, } from '../../../protocol.ts';
import { createDiagnosticRange, } from './range.ts';

/** Severity names that map to CSS highlight names. */
const SEVERITY_LEVELS = ['error', 'warning', 'info', 'hint',] as const;

/**
 * Applies diagnostic highlights to the editor using the CSS Custom Highlight API.
 * Groups diagnostics by severity and creates a named highlight for each level.
 * Previous highlights for all severity levels are replaced.
 *
 * @param editor - contenteditable container element
 *
 * @param diagnostics - array of diagnostics to render
 */
export function applyDiagnosticHighlights({ editor, diagnostics, }: {
  editor: HTMLElement;
  diagnostics: Diagnostic[];
},): void {
  /** Group diagnostics by severity. */
  const bySeverity = new Map<string, globalThis.Range[]>();
  for (const level of SEVERITY_LEVELS)
    bySeverity.set(level, [],);

  for (const diagnostic of diagnostics) {
    const range = createDiagnosticRange({ editor, diagnostic, },);
    if (range !== null)
      bySeverity.get(diagnostic.severity,)?.push(range,);
  }

  /** Register or remove highlights for each severity level. */
  for (const level of SEVERITY_LEVELS) {
    const highlightName = `diag-${level}`;
    const ranges = bySeverity.get(level,);
    if (ranges === undefined)
      continue;

    if (ranges.length > 0)
      CSS.highlights.set(highlightName, new Highlight(...ranges,),);
    else
      CSS.highlights.delete(highlightName,);
  }
}

/**
 * Clears all diagnostic highlights from the CSS Custom Highlight API.
 */
export function clearDiagnosticHighlights(): void {
  for (const level of SEVERITY_LEVELS)
    CSS.highlights.delete(`diag-${level}`,);
}
