/**
 * Diagnostic highlight layer for the editor.
 *
 * Applies wavy underlines to text ranges using the CSS Custom Highlight API.
 * Four severity levels are supported: error, warning, info, and hint.
 * Each severity maps to a separate highlight name (`diag-error`, etc.)
 * so they can be independently styled in CSS.
 */

import type { Diagnostic, } from '../protocol.ts';

/** Severity names that map to CSS highlight names. */
const SEVERITY_LEVELS = ['error', 'warning', 'info', 'hint',] as const;

/**
 * Finds the text node and offset at a character position within a line div.
 * Walks the tree of text nodes and sums their lengths to locate the target offset.
 *
 * @param lineDiv - the per-line div element
 *
 * @param charOffset - 0-based character offset within the line's text
 *
 * @returns text node and offset, or null if beyond the line's length
 */
function findTextOffset({ lineDiv, charOffset, }: {
  lineDiv: Element;
  charOffset: number;
}): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
  let remaining = charOffset;
  let textNode = walker.nextNode();

  while (textNode !== null) {
    const len = textNode.textContent?.length ?? 0;
    if (remaining <= len) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- TreeWalker with SHOW_TEXT filter only yields Text nodes
      return { node: textNode as Text, offset: remaining, };
    }
    remaining -= len;
    textNode = walker.nextNode();
  }

  return null;
}

/**
 * Creates a DOM Range for a diagnostic's text range within the editor.
 *
 * @param editor - the contenteditable container element
 *
 * @param diagnostic - diagnostic with start/end line and character positions
 *
 * @returns DOM Range spanning the diagnostic text, or null if positions are out of bounds
 */
function createDiagnosticRange({ editor, diagnostic, }: {
  editor: HTMLElement;
  diagnostic: Diagnostic;
}): globalThis.Range | null {
  const startDiv = editor.children[diagnostic.range.start.line];
  const endDiv = editor.children[diagnostic.range.end.line];
  if (startDiv === undefined || endDiv === undefined)
    return null;

  const startPos = findTextOffset({ lineDiv: startDiv, charOffset: diagnostic.range.start.character, },);
  const endPos = findTextOffset({ lineDiv: endDiv, charOffset: diagnostic.range.end.character, },);
  if (startPos === null || endPos === null)
    return null;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset,);
  range.setEnd(endPos.node, endPos.offset,);
  return range;
}

/**
 * Applies diagnostic highlights to the editor using the CSS Custom Highlight API.
 * Groups diagnostics by severity and creates a named highlight for each level.
 * Previous highlights for all severity levels are replaced.
 *
 * @param editor - the contenteditable container element
 *
 * @param diagnostics - array of diagnostics to render
 */
export function applyDiagnosticHighlights({ editor, diagnostics, }: {
  editor: HTMLElement;
  diagnostics: Diagnostic[];
}): void {
  /** Group diagnostics by severity. */
  const bySeverity = new Map<string, globalThis.Range[]>();
  for (const level of SEVERITY_LEVELS) {
    bySeverity.set(level, [],);
  }

  for (const diagnostic of diagnostics) {
    const range = createDiagnosticRange({ editor, diagnostic, },);
    if (range !== null) {
      bySeverity.get(diagnostic.severity,)?.push(range,);
    }
  }

  /** Register or remove highlights for each severity level. */
  for (const level of SEVERITY_LEVELS) {
    const highlightName = `diag-${level}`;
    const ranges = bySeverity.get(level,);
    if (ranges === undefined)
      continue;

    if (ranges.length > 0) {
      CSS.highlights.set(highlightName, new Highlight(...ranges,),);
    }
    else {
      CSS.highlights.delete(highlightName,);
    }
  }
}

/**
 * Clears all diagnostic highlights from the CSS Custom Highlight API.
 */
export function clearDiagnosticHighlights(): void {
  for (const level of SEVERITY_LEVELS) {
    CSS.highlights.delete(`diag-${level}`,);
  }
}
