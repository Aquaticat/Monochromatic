/**
 * Line-level editing operations for the contenteditable editor.
 *
 * Each function operates on raw DOM elements and returns the new
 * cursor position. The EditorPane class coordinates calling these
 * with cursor restoration and highlight scheduling.
 */

/**
 * Deletes the line div at the given position.
 * If the editor has only one line, it is cleared rather than removed.
 *
 * @param editor - contenteditable container element
 *
 * @param line - 0-based line index to delete
 *
 * @param character - 0-based character offset for cursor placement
 *
 * @returns new cursor position after deletion
 */
export function deleteLineAt({ editor, line, character, }: {
  editor: HTMLDivElement; line: number; character: number;
}): { line: number; character: number } {
  const { children, } = editor;
  if (children.length <= 1) {
    /** Single line — clear it instead of removing. */
    const [only,] = children;
    if (only !== undefined) only.textContent = '\n';
    return { line: 0, character: 0, };
  }

  const lineDiv = children[line];
  if (lineDiv === undefined) return { line, character, };
  lineDiv.remove();

  /** Place cursor on the line that now occupies the deleted index, or the new last line. */
  const nextLine = Math.min(line, children.length - 1,);
  return { line: nextLine, character, };
}

/**
 * Duplicates the line div at the given position below.
 *
 * @param editor - contenteditable container element
 *
 * @param line - 0-based line index to duplicate
 *
 * @param character - 0-based character offset for cursor placement
 *
 * @returns new cursor position on the duplicated line
 */
export function duplicateLineAt({ editor, line, character, }: {
  editor: HTMLDivElement; line: number; character: number;
}): { line: number; character: number } | null {
  const lineDiv = editor.children[line];
  if (lineDiv === undefined) return null;
  const clone = lineDiv.cloneNode(true,);
  lineDiv.after(clone,);
  return { line: line + 1, character, };
}

/**
 * Swaps the line at the given position with the next line.
 *
 * @param editor - contenteditable container element
 *
 * @param line - 0-based line index to swap down
 *
 * @param character - 0-based character offset for cursor placement
 *
 * @returns new cursor position, or null if on the last line
 */
export function swapLineDown({ editor, line, character, }: {
  editor: HTMLDivElement; line: number; character: number;
}): { line: number; character: number } | null {
  const { children, } = editor;
  if (line >= children.length - 1) return null;

  const currentDiv = children[line];
  const nextDiv = children[line + 1];
  if (currentDiv === undefined || nextDiv === undefined) return null;

  nextDiv.after(currentDiv,);
  return { line: line + 1, character, };
}

/**
 * Swaps the line at the given position with the previous line.
 *
 * @param editor - contenteditable container element
 *
 * @param line - 0-based line index to swap up
 *
 * @param character - 0-based character offset for cursor placement
 *
 * @returns new cursor position, or null if on the first line
 */
export function swapLineUp({ editor, line, character, }: {
  editor: HTMLDivElement; line: number; character: number;
}): { line: number; character: number } | null {
  if (line <= 0) return null;

  const { children, } = editor;
  const currentDiv = children[line];
  const prevDiv = children[line - 1];
  if (currentDiv === undefined || prevDiv === undefined) return null;

  prevDiv.before(currentDiv,);
  return { line: line - 1, character, };
}
