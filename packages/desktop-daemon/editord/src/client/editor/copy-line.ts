/**
 * Line-copy operation for the contenteditable editor.
 *
 * Selects and copies the current line when no text is selected,
 * mirroring JetBrains behavior (Ctrl+C with empty selection).
 */

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
  editor: HTMLDivElement;
  line: number;
  composedRange: StaticRange;
},): boolean {
  if (!composedRange.collapsed)
    return false;

  /** Line div at the cursor's line index; undefined when the document has fewer lines than expected. */
  const lineDiv = editor.children[line];
  if (lineDiv === undefined)
    return false;

  /** Document selection; absent when the platform denies access (e.g. detached document). */
  const selection = document.getSelection();
  if (selection === null)
    return false;

  /** Walker over the line's text nodes; used to find the first and last text node for setBaseAndExtent. */
  const walker = document.createTreeWalker(
    lineDiv,
    NodeFilter.SHOW_TEXT,
  );
  /** First text node within the line; selection anchor goes here at offset 0. */
  const firstText = walker.nextNode();
  if (firstText === null)
    return false;

  /** Last text node seen so far; updated each iteration so the loop ends with the rightmost. */
  let lastText: Node = firstText;
  /** Walker lookahead; null marks the end of the line's text nodes. */
  let next = walker.nextNode();
  while (next !== null) {
    lastText = next;
    next = walker.nextNode();
  }

  /** Length of the last text node so the focus offset lands at the very end of the line. */
  const lastLen = lastText.textContent?.length ?? 0;
  selection.setBaseAndExtent(
    firstText,
    0,
    lastText,
    lastLen,
  );

  /** Raw line text, including any leading whitespace; empty lines are represented as `\n`. */
  const raw = lineDiv.textContent;
  void navigator.clipboard.writeText(`${raw === '\n' ? '' : raw}\n`,);
  return true;
}
