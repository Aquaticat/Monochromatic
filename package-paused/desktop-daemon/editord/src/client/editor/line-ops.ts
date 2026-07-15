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
 *
 * @example
 * ```ts
 * const result = deleteLineAt({ editor: editor, line: 10, character: 5, });
 * ```
 */
export function deleteLineAt({
  editor,
  line,
  character,
}: {
  readonly editor: HTMLDivElement;
  readonly line: number;
  readonly character: number;
},): {
  readonly line: number;
  readonly character: number;
} {
  /**
   * Live HTMLCollection so subsequent edits observe the post-removal length.
   */
  const { children, } = editor;
  if (children.length
    <= 1) {
    /**
     * Single line: clear it instead of removing.
     */
    const [only,] = children;
    if (only !== undefined)
      only.textContent = '\n';
    return {
      line: 0,
      character: 0,
    };
  }

  /**
   * Out-of-range index returns the cursor unchanged rather than throwing.
   */
  const lineDiv = children[line];
  if (lineDiv === undefined) {
    return {
      line,
      character,
    };
  }
  lineDiv.remove();

  /**
   * Place cursor on the line that now occupies the deleted index, or the new last line.
   */
  const nextLine = Math.min(
    line,
    children.length
      - 1,
  );
  return {
    line: nextLine,
    character,
  };
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
 *
 * @example
 * ```ts
 * const result = duplicateLineAt({ editor: editor, line: 10, character: 5, });
 * ```
 */
export function duplicateLineAt({
  editor,
  line,
  character,
}: {
  readonly editor: HTMLDivElement;
  readonly line: number;
  readonly character: number;
},): {
  readonly line: number;
  readonly character: number;
} | null {
  /**
   * Source line for the duplicate; null result signals out-of-range.
   */
  const lineDiv = editor.children[line];
  if (lineDiv === undefined)
    return null;
  /**
   * Deep clone so child nodes (highlights) replicate, not share references.
   */
  const clone = lineDiv.cloneNode(true,);
  lineDiv.after(clone,);
  return {
    line: line + 1,
    character,
  };
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
 *
 * @example
 * ```ts
 * const result = swapLineDown({ editor: editor, line: 10, character: 5, });
 * ```
 */
export function swapLineDown({
  editor,
  line,
  character,
}: {
  readonly editor: HTMLDivElement;
  readonly line: number;
  readonly character: number;
},): {
  readonly line: number;
  readonly character: number;
} | null {
  /**
   * Length needed before grabbing the neighbour to confirm the move is in range.
   */
  const { children, } = editor;
  if (line >= (children.length
    - 1))
    return null;

  /**
   * Element being moved past its successor.
   */
  const currentDiv = children[line];
  /**
   * Successor that becomes the predecessor after the swap.
   */
  const nextDiv = children[line + 1];
  if ((currentDiv === undefined) || (nextDiv === undefined))
    return null;

  nextDiv.after(currentDiv,);
  return {
    line: line + 1,
    character,
  };
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
 *
 * @example
 * ```ts
 * const result = swapLineUp({ editor: editor, line: 10, character: 5, });
 * ```
 */
export function swapLineUp({
  editor,
  line,
  character,
}: {
  readonly editor: HTMLDivElement;
  readonly line: number;
  readonly character: number;
},): {
  readonly line: number;
  readonly character: number;
} | null {
  if (line <= 0)
    return null;

  /**
   * Live HTMLCollection used to look up both neighbour divs.
   */
  const { children, } = editor;
  /**
   * Element being moved past its predecessor.
   */
  const currentDiv = children[line];
  /**
   * Predecessor that becomes the successor after the swap.
   */
  const prevDiv = children[line - 1];
  if ((currentDiv === undefined) || (prevDiv === undefined))
    return null;

  prevDiv.before(currentDiv,);
  return {
    line: line - 1,
    character,
  };
}
