/**
 * Text node resolution utilities for the contenteditable editor.
 *
 * Maps between DOM tree walker positions and line/character coordinates
 * used by the editor pane component.
 */

/** Single indent level: two spaces. */
export const INDENT_UNIT = '  ';

/**
 * Resolves a text node and offset within a line div for
 * `setBaseAndExtent`. Walks text nodes to find the one
 * containing the target character offset.
 *
 * @param editor - contenteditable container element
 *
 * @param lineIndex - 0-based line index
 *
 * @param character - 0-based character offset within the line
 *
 * @returns text node and offset, or null if not resolvable
 */
export function resolveTextPosition({ editor, lineIndex, character, }: {
  editor: HTMLDivElement;
  lineIndex: number;
  character: number;
},): { node: Node; offset: number; } | null {
  const lineDiv = editor.children[lineIndex];
  if (lineDiv === undefined)
    return null;

  const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
  let remaining = character;
  let textNode = walker.nextNode();
  while (textNode !== null) {
    const len = textNode.textContent?.length ?? 0;
    if (remaining <= len)
      return { node: textNode, offset: remaining, };
    remaining -= len;
    textNode = walker.nextNode();
  }

  /** Offset past end — clamp to last text node's end. */
  const { lastChild, } = lineDiv;
  if (lastChild !== null)
    return { node: lastChild, offset: lastChild.textContent?.length ?? 0, };
  return null;
}

/**
 * Resolves a DOM container node and offset to a line/character position.
 * Walks up the DOM to find the line div, then sums text node lengths.
 *
 * @param editor - contenteditable container element
 *
 * @param container - DOM node from the range boundary
 *
 * @param offset - offset within the container node
 *
 * @returns 0-based line and character, or null
 */
export function resolveLineCharacter({ editor, container, offset, }: {
  editor: HTMLDivElement;
  container: Node;
  offset: number;
},): { line: number; character: number; } | null {
  let node: Node | null = container;
  let lineDiv: HTMLElement | null = null;
  while (node !== null && node !== editor) {
    if (node.parentNode === editor && node instanceof HTMLElement) {
      lineDiv = node;
      break;
    }
    node = node.parentNode;
  }
  if (lineDiv === null)
    return null;

  const line = [...editor.children,].indexOf(lineDiv,);
  if (line === -1)
    return null;

  let character = 0;
  const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
  let textNode = walker.nextNode();
  while (textNode !== null) {
    if (textNode === container) {
      character += offset;
      break;
    }
    character += textNode.textContent?.length ?? 0;
    textNode = walker.nextNode();
  }

  return { line, character, };
}
