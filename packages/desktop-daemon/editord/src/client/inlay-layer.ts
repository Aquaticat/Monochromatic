/**
 * Inlay annotation layer for the editor.
 *
 * Combines inlay hints and diagnostic messages into per-line annotations
 * rendered via `::after` on line divs using `data-inlay` attributes.
 * Zero DOM contamination: annotations are pure CSS pseudo-elements.
 */

import type { Diagnostic, InlayHint, } from '../protocol.ts';
import { applyLineAnnotation, groupByLine, } from './inlay-line.ts';

/**
 * Extracts the line number from an inlay hint.
 *
 * @param hint - inlay hint to extract line from
 *
 * @returns 0-based line number
 */
function hintLine(hint: InlayHint,): number { return hint.position.line; }

/**
 * Extracts the start line number from a diagnostic.
 *
 * @param diagnostic - diagnostic to extract line from
 *
 * @returns 0-based line number
 */
function diagLine(diagnostic: Diagnostic,): number { return diagnostic.range.start.line; }

/**
 * Applies inlay annotations to the editor's line divs.
 *
 * Groups inlay hints and diagnostics by line number, builds a combined
 * annotation string per line, and sets `data-inlay` and `data-inlay-severity`
 * attributes. Lines without annotations have their attributes removed.
 *
 * @param editor - contenteditable container element
 *
 * @param hints - inlay hints from the language server
 *
 * @param diagnostics - diagnostics from the language server
 */
export function applyInlayAnnotations({ editor, hints, diagnostics, }: {
  editor: HTMLElement;
  hints: InlayHint[];
  diagnostics: Diagnostic[];
}): void {
  const hintsByLine = groupByLine({ items: hints, keyFn: hintLine, },);
  const diagsByLine = groupByLine({ items: diagnostics, keyFn: diagLine, },);
  const allLines = new Set([...hintsByLine.keys(), ...diagsByLine.keys(),],);
  const { children, } = editor;

  for (const line of allLines) {
    const div = children[line];
    if (div !== undefined && div instanceof HTMLElement)
      applyLineAnnotation({ div, lineHints: hintsByLine.get(line,), lineDiags: diagsByLine.get(line,), },);
  }

  /** Clear stale annotations from lines no longer in the set. */
  for (let i = 0; i < children.length; i++) {
    if (allLines.has(i,))
      continue;

    const div = children[i];
    if (div instanceof HTMLElement && div.dataset.inlay !== undefined) {
      delete div.dataset.inlay;
      delete div.dataset.inlayChar;
      delete div.dataset.inlaySeverity;
      div.style.removeProperty('--inlay-indent',);
      div.style.removeProperty('--line-num-offset',);
    }
  }
}

/**
 * Clears all inlay annotations from the editor's line divs.
 *
 * @param editor - contenteditable container element
 */
export function clearInlayAnnotations({ editor, }: { editor: HTMLElement }): void {
  for (const child of editor.children) {
    if (child instanceof HTMLElement) {
      delete child.dataset.inlay;
      delete child.dataset.inlayChar;
      delete child.dataset.inlaySeverity;
      child.style.removeProperty('--inlay-indent',);
      child.style.removeProperty('--line-num-offset',);
    }
  }
}
