/**
 * Editor selection overlay.
 *
 * Tracks the cursor and any active selection as buffer offsets, not
 * DOM Ranges, so the position survives viewport re-renders that
 * recreate the underlying line nodes (per plan §1).
 *
 * Two responsibilities:
 *
 * 1. Read the browser-managed selection on the contenteditable
 *    surface and translate it into buffer offsets so the input layer
 *    knows where edits land.
 * 2. After the editor mutates the buffer, write the updated offsets
 *    back into a DOM Range so the user's cursor stays where they
 *    expect.
 *
 * The translation between DOM positions and buffer offsets walks the
 * line elements rendered by `viewport.ts`. Each line carries a
 * `data-line` index attribute we use to recover its line number.
 */

/** Public selection handle returned by `mountSelection`. */
export type Selection = {
  /** Read the current selection, or `null` if not in this surface. */
  get(): {
    from: number;
    to: number;
  } | null;
  /**
   * Write a selection. `from === to` means a collapsed cursor.
   *
   * @param input - half-open offset range
   */
  set(input: {
    from: number;
    to: number;
  },): void;
  /** Detach event listeners and clear pending state. */
  destroy(): void;
};

/**
 * Mounts the selection layer on the surface inside `host`. Listens for
 * `selectionchange` to keep an internal cache up-to-date and exposes
 * `get`/`set` for the input layer.
 *
 * @param input - the host element and the contenteditable surface
 *
 * @returns selection handle
 *
 * @example
 * ```ts
 * const selection = mountSelection({ host, surface });
 * selection.set({ from: 5, to: 5 });
 * ```
 */
export function mountSelection(
  input: {
    host: HTMLElement;
    surface: HTMLElement;
  },
): Selection {
  /**
   * Walk the surface's line elements and return the offset of the
   * given DOM `(node, offset)` position. Returns `null` if the node
   * is outside any line in the surface.
   *
   * @param domInput - DOM node and the offset within that node
   *
   * @returns absolute buffer offset or `null`
   */
  function domToOffset(
    domInput: {
      node: Node;
      offset: number;
    },
  ): number | null {
    let line: HTMLElement | null = null;
    let runner: Node | null = domInput.node;
    while (runner !== null) {
      if (
        runner instanceof HTMLElement
        && runner.classList.contains('ce-line',)
      ) {
        line = runner;
        break;
      }
      runner = runner.parentNode;
    }
    if (line === null)
      return null;
    const lineIndex = Number.parseInt(
      line.dataset['line'] ?? '',
      10,
    );
    if (Number.isNaN(lineIndex,))
      return null;
    // Sum the lengths of preceding lines (with a trailing newline
    // each) plus the offset within the current line. We use the
    // surface's textContent to recover line lengths since the line's
    // textContent matches the buffer slice the viewport rendered.
    let absolute = 0;
    const lines = [
      ...input.surface.querySelectorAll<HTMLElement>('.ce-line',),
    ];
    for (const candidate of lines) {
      const candidateIndex = Number.parseInt(
        candidate.dataset['line'] ?? '',
        10,
      );
      if (Number.isNaN(candidateIndex,))
        continue;
      if (candidateIndex >= lineIndex)
        break;
      absolute += (candidate.textContent ?? '').length + 1;
    }
    // Within the line: sum text-node lengths up to the requested
    // offset. The line typically has a single text child, but the
    // browser may insert extra nodes for IME composition.
    let withinLine = 0;
    let foundTarget = false;
    /**
     * Recursive DFS that tallies code-unit lengths of text nodes
     * preceding the target `(node, offset)`. Sets `foundTarget` once
     * the target node is reached so subsequent nodes are skipped.
     *
     * @param node - current DFS node
     */
    function walk(node: Node,): void {
      if (foundTarget)
        return;
      if (node === domInput.node) {
        withinLine += domInput.offset;
        foundTarget = true;
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        withinLine += (node.textContent ?? '').length;
        return;
      }
      for (const child of node.childNodes)
        walk(child,);
    }
    walk(line,);
    return absolute + withinLine;
  }

  /** Cache of the most recent selection in surface-local offsets. */
  let cached: {
    from: number;
    to: number;
  } | null = null;

  /**
   * Reads the current `document.getSelection()` and translates it into
   * buffer offsets in `cached`. Sets `cached` to `null` when the
   * selection is not inside the editor surface.
   */
  function refresh(): void {
    const sel = document.getSelection();
    if (sel === null || sel.rangeCount === 0) {
      cached = null;
      return;
    }
    const range = sel.getRangeAt(0,);
    if (!input.surface.contains(range.startContainer,)) {
      cached = null;
      return;
    }
    const from = domToOffset({
      node: range.startContainer,
      offset: range.startOffset,
    },);
    const to = domToOffset({
      node: range.endContainer,
      offset: range.endOffset,
    },);
    if (from === null || to === null) {
      cached = null;
      return;
    }
    cached = {
      from: Math.min(
        from,
        to,
      ),
      to: Math.max(
        from,
        to,
      ),
    };
  }

  document.addEventListener(
    'selectionchange',
    refresh,
  );

  /**
   * Walks the surface to find the (text node, offset) corresponding
   * to a buffer offset. Used to project a buffer-offset selection
   * back into the DOM after a viewport re-render.
   *
   * @param target - target buffer offset
   *
   * @returns DOM position or `null` if no matching line is rendered
   */
  function offsetToDom(
    target: { offset: number; },
  ): {
    node: Node;
    offset: number
  } | null {
    let cursor = 0;
    const lines = [
      ...input.surface.querySelectorAll<HTMLElement>('.ce-line',),
    ];
    for (const line of lines) {
      const lineLength = (line.textContent ?? '').length;
      const lineEnd = cursor + lineLength;
      if (target.offset <= lineEnd) {
        const text = line.firstChild;
        if (text !== null && text.nodeType === Node.TEXT_NODE) {
          return {
            node: text,
            offset: target.offset - cursor,
          };
        }
        return {
          node: line,
          offset: 0,
        };
      }
      // +1 for the trailing newline between lines.
      cursor = lineEnd + 1;
    }
    return null;
  }

  return {
    get() {
      // Refresh on each get so callers always see the latest browser
      // state (selectionchange may not have fired yet for synthetic
      // events).
      refresh();
      return cached;
    },
    set(target,) {
      const start = offsetToDom({ offset: target.from, },);
      const end = offsetToDom({ offset: target.to, },);
      if (start === null || end === null)
        return;
      const sel = document.getSelection();
      if (sel === null)
        return;
      const range = document.createRange();
      range.setStart(
        start.node,
        start.offset,
      );
      range.setEnd(
        end.node,
        end.offset,
      );
      sel.removeAllRanges();
      sel.addRange(range,);
      cached = {
        from: target.from,
        to: target.to,
      };
    },
    destroy() {
      document.removeEventListener(
        'selectionchange',
        refresh,
      );
      cached = null;
    },
  };
}
