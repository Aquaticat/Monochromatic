/**
 * DOM range creation for diagnostic highlights.
 *
 * Walks text nodes in line divs to map LSP character offsets
 * to DOM Range objects for the CSS Custom Highlight API.
 */

import type { Diagnostic, } from '../../../protocol.ts';

/**
 * Finds the text node and offset at a character position within a line div.
 * Walks the tree of text nodes and sums their lengths to locate the target offset.
 *
 * @param lineDiv - per-line div element
 *
 * @param charOffset - 0-based character offset within the line's text
 *
 * @returns text node and offset, or null if beyond the line's length
 *
 * @example
 * ```ts
 * const result = findTextOffset({ lineDiv: lineElement, charOffset: 15, });
 * ```
 */
export function findTextOffset({
  lineDiv,
  charOffset,
}: {
  readonly lineDiv: Element;
  readonly charOffset: number;
},): {
  readonly node: Text;
  readonly offset: number;
} | null {
  /**
   * SHOW_TEXT walker keeps the loop body free of element-node guards.
   */
  const walker = document.createTreeWalker(
    lineDiv,
    NodeFilter.SHOW_TEXT,
  );
  /**
   * Decrements as the walker advances; the matching node is the one that goes non-positive.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- tree-walker state machine: `remaining` shrinks by each visited node's text length
  let remaining = charOffset;
  /**
   * Walker cursor; null means the offset is past the end of the line.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- tree-walker state machine: `textNode` is advanced via `walker.nextNode()` each iteration
  let textNode = walker.nextNode();

  while (textNode !== null) {
    /**
     * Defensive default keeps the count advancing past nodes with null content.
     */
    const len = textNode.textContent
      ?.length
      ?? 0;
    if (remaining <= len) {
      return {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- TreeWalker with SHOW_TEXT filter only yields Text nodes
        node: textNode as Text,
        offset: remaining,
      };
    }
    remaining -= len;
    textNode = walker.nextNode();
  }

  return null;
}

/**
 * Creates a DOM Range for a diagnostic's text range within the editor.
 *
 * @param editor - contenteditable container element
 *
 * @param diagnostic - diagnostic with start/end line and character positions
 *
 * @returns DOM Range spanning the diagnostic text, or null if positions are out of bounds
 *
 * @example
 * ```ts
 * const result = createDiagnosticRange({ editor: editor, diagnostic: { range: { start: { line: 3, character: 0 }, end: { line: 3, character: 20 } }, severity: "error", message: "Type error", source: "tsc" }, });
 * ```
 */
export function createDiagnosticRange({
  editor,
  diagnostic,
}: {
  readonly editor: HTMLElement;
  readonly diagnostic: Diagnostic;
},): globalThis.Range | null {
  /**
   * Out-of-bounds line index returns null instead of throwing.
   */
  const startDiv = editor.children[diagnostic.range
    .start
    .line];
  /**
   * Out-of-bounds line index returns null instead of throwing.
   */
  const endDiv = editor.children[diagnostic.range
    .end
    .line];
  if ((startDiv === undefined) || (endDiv === undefined))
    return null;

  /**
   * Resolved DOM position; null when the start column is past end-of-line.
   */
  const startPos = findTextOffset({
    lineDiv: startDiv,
    charOffset: diagnostic.range
      .start
      .character,
  },);
  /**
   * Resolved DOM position; null when the end column is past end-of-line.
   */
  const endPos = findTextOffset({
    lineDiv: endDiv,
    charOffset: diagnostic.range
      .end
      .character,
  },);
  if ((startPos === null) || (endPos === null))
    return null;

  /**
   * Mutable Range built up across the next few setStart/setEnd calls.
   */
  const range = document.createRange();
  range.setStart(
    startPos.node,
    startPos.offset,
  );
  range.setEnd(
    endPos.node,
    endPos.offset,
  );
  return range;
}
