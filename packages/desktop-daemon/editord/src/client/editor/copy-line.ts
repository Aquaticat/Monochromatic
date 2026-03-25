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

  const lineDiv = editor.children[line];
  if (lineDiv === undefined)
    return false;

  const selection = document.getSelection();
  if (selection === null)
    return false;

  const walker = document.createTreeWalker(
    lineDiv,
    NodeFilter.SHOW_TEXT,
  );
  const firstText = walker.nextNode();
  if (firstText === null)
    return false;

  let lastText: Node = firstText;
  let next = walker.nextNode();
  while (next !== null) {
    lastText = next;
    next = walker.nextNode();
  }

  const lastLen = lastText.textContent?.length ?? 0;
  selection.setBaseAndExtent(
    firstText,
    0,
    lastText,
    lastLen,
  );

  const raw = lineDiv.textContent;
  void navigator.clipboard.writeText(`${raw === '\n' ? '' : raw}\n`,);
  return true;
}
