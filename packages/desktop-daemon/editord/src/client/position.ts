/**
 * Selection-based cursor position utilities for the editor.
 *
 * Maps browser Selection/caret state to 0-based line/character
 * positions suitable for LSP requests. Works with the per-line-div
 * structure of the `<editor-pane>` contenteditable.
 */

/** 0-based text position in the editor. */
export type EditorPosition = {
  /** 0-based line index. */
  line: number;
  /** 0-based character offset within the line. */
  character: number;
};

/**
 * Resolves the current cursor position from a Selection within the editor.
 *
 * @param editor - the contenteditable container element
 *
 * @param selection - the current Selection
 *
 * @returns cursor position, or null if the selection is not within the editor
 */
export function getCursorPosition({ editor, selection, }: {
  editor: HTMLElement;
  selection: Selection | null;
}): EditorPosition | null {
  if (selection === null || selection.anchorNode === null)
    return null;

  let node: Node | null = selection.anchorNode;

  /** Walk up to find the line div (direct child of editor). */
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

  /** Compute character offset by summing text node lengths before the anchor. */
  let character = 0;
  const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
  let textNode = walker.nextNode();
  while (textNode !== null) {
    if (textNode === selection.anchorNode) {
      character += selection.anchorOffset;
      break;
    }
    character += textNode.textContent?.length ?? 0;
    textNode = walker.nextNode();
  }

  return { line, character, };
}
