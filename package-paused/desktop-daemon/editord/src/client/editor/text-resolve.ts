/**
 * Text node resolution utilities for the contenteditable editor.
 *
 * Maps between DOM tree walker positions and line/character coordinates
 * used by the editor pane component.
 */

/**
 * Single indent level: two spaces.
 */
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
 *
 * @example
 * ```ts
 * const result = resolveTextPosition({ editor: editor, lineIndex: 0, character: 5, });
 * ```
 */
export function resolveTextPosition({
  editor,
  lineIndex,
  character,
}: {
  readonly editor: HTMLDivElement;
  readonly lineIndex: number;
  readonly character: number;
},): {
  readonly node: Node;
  readonly offset: number;
} | null {
  /**
   * Line element at `lineIndex`; undefined when the index is past the editor's end.
   */
  const lineDiv = editor.children[lineIndex];
  if (lineDiv === undefined)
    return null;

  /**
   * Text-only walker over the line so syntax-highlight spans are skipped.
   */
  const walker = document.createTreeWalker(
    lineDiv,
    NodeFilter.SHOW_TEXT,
  );
  /**
   * Characters still to consume; decremented by each text-node length until the target node is reached.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- tree-walker cursor: `remaining` decrements until the target node is found
  let remaining = character;
  /**
   * Current text node under inspection; null exits the walk.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- tree-walker cursor: `textNode` advances via `walker.nextNode()`
  let textNode = walker.nextNode();
  while (textNode !== null) {
    /**
     * Length of the current text node; treat null textContent as 0.
     */
    const len = textNode.textContent
      ?.length
      ?? 0;
    if (remaining <= len) {
      return {
        node: textNode,
        offset: remaining,
      };
    }
    remaining -= len;
    textNode = walker.nextNode();
  }

  /**
   * Offset past end: clamp to last text node's end.
   */
  const { lastChild, } = lineDiv;
  if (lastChild !== null) {
    return {
      node: lastChild,
      offset: lastChild.textContent
        ?.length
        ?? 0,
    };
  }
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
 *
 * @example
 * ```ts
 * const result = resolveLineCharacter({ editor: editor, container: dirElement, offset: 42, });
 * ```
 */
export function resolveLineCharacter({
  editor,
  container,
  offset,
}: {
  readonly editor: HTMLDivElement;
  readonly container: Node;
  readonly offset: number;
},): {
  readonly line: number;
  readonly character: number;
} | null {
  /**
   * Walk cursor; starts at the caller's container and rises until it hits the editor or runs out.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- ancestor-walk cursor: `node` rises via `parentNode` until it matches the editor or null
  let node: Node | null = container;
  /**
   * First ancestor that is a direct child of the editor; identifies the owning line.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- ancestor-walk cursor: `lineDiv` is set inside the loop when the editor-child ancestor is found
  let lineDiv: HTMLElement | null = null;
  while ((node !== null) && (node !== editor)) {
    if ((node.parentNode
      === editor) && (node instanceof HTMLElement)) {
      lineDiv = node;
      break;
    }
    node = node.parentNode;
  }
  if (lineDiv === null)
    return null;

  /**
   * Zero-based line index of `lineDiv`; -1 when the element is not actually under the editor.
   */
  const line = Array.prototype
    .indexOf
    .call(
    editor.children,
    lineDiv,
  );
  if (line === (-1))
    return null;

  /**
   * Character offset within the line; summed across text nodes until the container is reached.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- tree-walker accumulator: `character` sums text-node lengths until the container node is matched
  let character = 0;
  /**
   * Text-only walker over the resolved line so the offset count skips highlight spans.
   */
  const walker = document.createTreeWalker(
    lineDiv,
    NodeFilter.SHOW_TEXT,
  );
  /**
   * Current text node; null exits the walk.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- tree-walker cursor: `textNode` advances via `walker.nextNode()`
  let textNode = walker.nextNode();
  while (textNode !== null) {
    if (textNode === container) {
      character += offset;
      break;
    }
    character += textNode.textContent
      ?.length
      ?? 0;
    textNode = walker.nextNode();
  }

  return {
    line,
    character,
  };
}
