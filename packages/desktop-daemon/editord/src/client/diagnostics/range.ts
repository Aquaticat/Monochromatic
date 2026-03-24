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
 */
export function findTextOffset({ lineDiv, charOffset, }: {
  lineDiv: Element;
  charOffset: number;
},): { node: Text; offset: number; } | null {
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
 * @param editor - contenteditable container element
 *
 * @param diagnostic - diagnostic with start/end line and character positions
 *
 * @returns DOM Range spanning the diagnostic text, or null if positions are out of bounds
 */
export function createDiagnosticRange({ editor, diagnostic, }: {
  editor: HTMLElement;
  diagnostic: Diagnostic;
},): globalThis.Range | null {
  const startDiv = editor.children[diagnostic.range.start.line];
  const endDiv = editor.children[diagnostic.range.end.line];
  if (startDiv === undefined || endDiv === undefined)
    return null;

  const startPos = findTextOffset({ lineDiv: startDiv,
    charOffset: diagnostic.range.start.character, },);
  const endPos = findTextOffset({ lineDiv: endDiv,
    charOffset: diagnostic.range.end.character, },);
  if (startPos === null || endPos === null)
    return null;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset,);
  range.setEnd(endPos.node, endPos.offset,);
  return range;
}
