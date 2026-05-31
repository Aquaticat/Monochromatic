/**
 * Line-copy operation for the contenteditable editor.
 *
 * Selects and copies the current line when no text is selected,
 * mirroring JetBrains behavior (Ctrl+C with empty selection).
 */

/**
 * Walks every text node in the subtree under `lineDiv` and returns the last one.
 *
 * Allowlist-shape helper extracted to satisfy the no-function-root-let rule:
 * the walker advances a cursor through the tree, and the helper's terminating
 * `return last` lets the caller treat the result as a value rather than mutated
 * state at function-body root.
 *
 * @param lineDiv - root element whose text-node subtree is walked
 *
 * @param firstText - first text node already retrieved by the caller; used as the seed for the walk
 *
 * @returns the final text node encountered; equals `firstText` when no further text nodes exist
 *
 * @example
 * ```ts
 * const last = findLastTextNode({ lineDiv: editor.children[3]!, firstText: textNode, });
 * ```
 */
function findLastTextNode({
  lineDiv,
  firstText,
}: {
  readonly lineDiv: Element;
  readonly firstText: Node;
},): Node {
  /**
   * Fresh walker so the caller's walker stays at its current position.
   */
  const walker = document.createTreeWalker(
    lineDiv,
    NodeFilter.SHOW_TEXT,
  );
  walker.currentNode = firstText;
  /**
   * Tracks the rightmost text node seen so far; updated each iteration
   * by the walker. The helper-shape `return last` allowlists this `let`.
   */
  let last: Node = firstText;
  /**
   * Walker lookahead; null ends the walk.
   */
  let next = walker.nextNode();
  while (next !== null) {
    last = next;
    next = walker.nextNode();
  }
  return last;
}

/**
 * Selects the full line at the cursor position and copies it to the clipboard.
 *
 * @param editor - contenteditable container element
 *
 * @param line - 0-based line index of the cursor
 *
 * @param composedRange - composed range from shadow DOM selection
 *
 * @returns true if the line was copied (selection was collapsed)
 *
 * @example
 * ```ts
 * const result = selectAndCopyLine({ editor: editor, line: 10, composedRange: range, });
 * ```
 */
export function selectAndCopyLine({
  editor,
  line,
  composedRange,
}: {
  readonly editor: HTMLDivElement;
  readonly line: number;
  readonly composedRange: StaticRange;
},): boolean {
  if (!composedRange.collapsed)
    return false;

  /**
   * Line div at the cursor's line index; undefined when the document has fewer lines than expected.
   */
  const lineDiv = editor.children[line];
  if (lineDiv === undefined)
    return false;

  /**
   * Document selection; absent when the platform denies access (e.g. detached document).
   */
  const selection = document.getSelection();
  if (selection === null)
    return false;

  /**
   * Walker over the line's text nodes; used to find the first and last text node for setBaseAndExtent.
   */
  const walker = document.createTreeWalker(
    lineDiv,
    NodeFilter.SHOW_TEXT,
  );
  /**
   * First text node within the line; selection anchor goes here at offset 0.
   */
  const firstText = walker.nextNode();
  if (firstText === null)
    return false;

  /**
   * Rightmost text node in the line's subtree; passed to `setBaseAndExtent` as the focus.
   */
  const lastText = findLastTextNode({
    lineDiv,
    firstText,
  },);

  /**
   * Length of the last text node so the focus offset lands at the very end of the line.
   */
  const lastLen = lastText.textContent
    ?.length
    ?? 0;
  selection.setBaseAndExtent(
    firstText,
    0,
    lastText,
    lastLen,
  );

  /**
   * Raw line text, including any leading whitespace; empty lines are represented as `\n`.
   */
  const raw = lineDiv.textContent;
  void navigator.clipboard
    .writeText(`${raw === '\n' ? '' : raw}\n`,);
  return true;
}
