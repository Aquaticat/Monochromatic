/**
 * Utilities for converting between DOM positions and text positions.
 *
 * Maps browser Selection/caret state to 0-based line/character
 * positions suitable for LSP requests. Works with the per-line-div
 * structure of the `<editor-pane>` contenteditable.
 *
 * `document.caretPositionFromPoint` does not penetrate shadow DOM,
 * so these utilities walk the shadow root's children geometrically
 * to find the line div and character offset under a given point.
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

/**
 * Resolves a text position from mouse coordinates within the editor.
 *
 * Uses geometric hit-testing against per-line divs since
 * `document.caretPositionFromPoint` does not penetrate shadow DOM.
 * Finds the line by bounding rect comparison, then estimates
 * the character offset using a binary search with Range measurement.
 *
 * @param editor - the contenteditable container element (inside shadow DOM)
 *
 * @param x - horizontal mouse coordinate (client pixels)
 *
 * @param y - vertical mouse coordinate (client pixels)
 *
 * @returns text position, or null if the coordinates are outside text
 */
export function getPositionFromPoint({ editor, x, y, }: {
  editor: HTMLElement;
  x: number;
  y: number;
}): EditorPosition | null {
  /** Find the line div at this y coordinate. */
  const lineResult = findLineAtY({ editor, y, },);
  if (lineResult === null)
    return null;

  /** Find the character offset at this x coordinate within the line. */
  const character = findCharAtX({ lineDiv: lineResult.lineDiv, x, },);
  return { line: lineResult.line, character, };
}

/**
 * Finds the line div whose bounding rect contains the y coordinate.
 *
 * @returns line index and element, or null if y is outside all lines
 */
function findLineAtY({ editor, y, }: {
  editor: HTMLElement;
  y: number;
}): { line: number; lineDiv: Element } | null {
  const { children, } = editor;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child === undefined)
      continue;

    const rect = child.getBoundingClientRect();
    if (y >= rect.top && y <= rect.bottom) {
      return { line: i, lineDiv: child, };
    }
  }

  return null;
}

/**
 * Estimates the character offset within a line div closest to the x coordinate.
 * Uses a binary search with Range measurement for efficiency.
 *
 * @returns 0-based character offset
 */
function findCharAtX({ lineDiv, x, }: {
  lineDiv: Element;
  x: number;
}): number {
  const text = lineDiv.textContent ?? '';
  if (text.length === 0 || text === '\n')
    return 0;

  /** Get the first text node in the line. */
  const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
  const firstTextNode = walker.nextNode();
  if (firstTextNode === null)
    return 0;

  /** Collect all text nodes with cumulative offsets. */
  const textNodes: { node: Text; start: number; length: number }[] = [];
  let total = 0;
  let current: Node | null = firstTextNode;
  while (current !== null) {
    const len = current.textContent?.length ?? 0;
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- TreeWalker SHOW_TEXT yields Text nodes
    textNodes.push({ node: current as Text, start: total, length: len, },);
    total += len;
    current = walker.nextNode();
  }

  /** Binary search for the character whose midpoint is closest to x. */
  let lo = 0;
  let hi = total;
  const range = document.createRange();

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const { node, localOffset, } = resolveOffset({ textNodes, offset: mid, },);
    range.setStart(node, localOffset,);
    range.setEnd(node, localOffset,);
    const rect = range.getBoundingClientRect();

    if (rect.left < x) {
      lo = mid + 1;
    }
    else {
      hi = mid;
    }
  }

  return lo;
}

/** Resolves a global character offset to a text node and local offset. */
function resolveOffset({ textNodes, offset, }: {
  textNodes: { node: Text; start: number; length: number }[];
  offset: number;
}): { node: Text; localOffset: number } {
  for (const entry of textNodes) {
    if (offset <= entry.start + entry.length) {
      return { node: entry.node, localOffset: offset - entry.start, };
    }
  }
  /** Clamp to end of last text node. */
  const last = textNodes[textNodes.length - 1];
  if (last !== undefined) {
    return { node: last.node, localOffset: last.length, };
  }
  /** Fallback: should never reach here with non-empty text. */
  const first = textNodes[0];
  if (first === undefined) throw new Error('resolveOffset called with empty textNodes',);
  return { node: first.node, localOffset: 0, };
}
