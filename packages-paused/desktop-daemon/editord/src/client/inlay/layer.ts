/**
 * Inlay annotation layer for the editor.
 *
 * Combines inlay hints and diagnostic messages into per-line annotations
 * rendered via `::after` on line divs using `data-inlay` attributes.
 * Zero DOM contamination: annotations are pure CSS pseudo-elements.
 */

import type {
  Diagnostic,
  InlayHint,
} from '../../../protocol.ts';
import {
  applyLineAnnotation,
  groupByLine,
} from './line.ts';
import { measureSpaceRatio, } from './measure.ts';

/**
 * Extracts the line number from an inlay hint.
 *
 * @param hint - inlay hint to extract line from
 *
 * @returns 0-based line number
 */
function hintLine(hint: InlayHint,): number {
  return hint.position
    .line;
}

/**
 * Extracts the start line number from a diagnostic.
 *
 * @param diagnostic - diagnostic to extract line from
 *
 * @returns 0-based line number
 */
function diagLine(diagnostic: Diagnostic,): number {
  return diagnostic.range
    .start
    .line;
}

/**
 * Tracks which line indices currently have annotations, enabling targeted cleanup.
 *
 * Mutated in-place by {@link applyInlayAnnotations} (clear + add) and
 * {@link clearInlayAnnotations} (clear) so the reference itself stays `const`.
 */
const annotatedLines = new Set<number>();

/**
 * Applies inlay annotations to the editor's line divs.
 *
 * Groups inlay hints and diagnostics by line number, builds a combined
 * annotation string per line, and sets `data-inlay` and `data-inlay-severity`
 * attributes. Lines without annotations have their attributes removed.
 * Only clears stale annotations from lines that previously had them,
 * avoiding an O(n) sweep of all editor children.
 *
 * @param editor - contenteditable container element
 *
 * @param hints - inlay hints from the language server
 *
 * @param diagnostics - diagnostics from the language server
 *
 * @example
 * ```ts
 * applyInlayAnnotations({ editor: editor, hints: [{ position: { line: 3, character: 10 }, label: ": number" }], diagnostics: [], });
 * ```
 */
export function applyInlayAnnotations({
  editor,
  hints,
  diagnostics,
}: {
  readonly editor: HTMLElement;
  readonly hints: readonly InlayHint[];
  readonly diagnostics: readonly Diagnostic[];
},): void {
  /**
   * Inter-to-mono space ratio used when composing per-line annotation strings.
   */
  const spaceRatio = measureSpaceRatio({ editor, },);
  /**
   * Hints bucketed by their line number so each line div sees only its own entries.
   */
  const hintsByLine = groupByLine({
    items: hints,
    keyFn: hintLine,
  },);
  /**
   * Diagnostics bucketed by their starting line number; same purpose as `hintsByLine`.
   */
  const diagsByLine = groupByLine({
    items: diagnostics,
    keyFn: diagLine,
  },);
  /**
   * Union of line indices that need annotations this pass; drives both apply and cleanup loops.
   */
  const newLines = new Set([
    ...hintsByLine.keys(),
    ...diagsByLine.keys(),
  ],);
  /**
   * Live HTMLCollection of editor line divs; indexed by line number.
   */
  const { children, } = editor;

  for (const line of newLines) {
    /**
     * Line div for the current line index, or undefined when the editor is shorter than expected.
     */
    const div = children[line];
    if ((div !== undefined) && (div instanceof HTMLElement)) {
      applyLineAnnotation({
        div,
        lineHints: hintsByLine.get(line,),
        lineDiags: diagsByLine
          .get(line,),
        spaceRatio,
      },);
    }
  }

  /**
   * Clear annotations only from lines that previously had them but no longer do.
   */
  for (const line of annotatedLines) {
    if (newLines.has(line,))
      continue;
    /**
     * Line div whose stale annotation must be removed; null when the line was deleted.
     */
    const div = children[line];
    if ((div instanceof HTMLElement) && (div.dataset
      .inlay
      !== undefined)) {
      delete div.dataset
        .inlay;
      delete div.dataset
        .inlaySeverity;
      div.style
        .removeProperty('--line-num-offset',);
    }
  }

  annotatedLines.clear();
  for (const line of newLines)
    annotatedLines.add(line,);
}

/**
 * Clears all inlay annotations from the editor's line divs.
 *
 * @param editor - contenteditable container element
 *
 * @example
 * ```ts
 * clearInlayAnnotations({ editor: editor, });
 * ```
 */
export function clearInlayAnnotations({ editor, }: { readonly editor: HTMLElement; },): void {
  for (const line of annotatedLines) {
    /**
     * Line div whose annotation attributes are being cleared on this teardown pass.
     */
    const child = editor.children[line];
    if (child instanceof HTMLElement) {
      delete child.dataset
        .inlay;
      delete child.dataset
        .inlaySeverity;
      child.style
        .removeProperty('--line-num-offset',);
    }
  }
  annotatedLines.clear();
}
