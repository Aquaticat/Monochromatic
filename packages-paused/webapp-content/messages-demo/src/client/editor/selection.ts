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


/**
 * Sentinel for an unresolved selection position: no selection in the
 * surface, or a DOM walk that ran off the rendered lines. A unique
 * `Symbol` rather than `null`: a resolved position is always an object
 * or numeric offset, so callers gate with `=== NO_SELECTION`.
 */
export const NO_SELECTION: unique symbol = Symbol('messages-demo:no-selection',);

/**
 * Public selection handle returned by `mountSelection`.
 */
export type Selection = {
  /**
   * Read the current selection, or `NO_SELECTION` if not in this surface.
   */
  get(): {
    readonly from: number;
    readonly to: number;
  } | typeof NO_SELECTION;
  /**
   * Write a selection. `from === to` means a collapsed cursor.
   *
   * @param input - half-open offset range
   */
  set(input: {
    readonly from: number;
    readonly to: number;
  },): void;
  /**
   * Detach event listeners and clear pending state.
   */
  destroy(): void;
};

/**
 * Walks the ancestor chain from `start` upward, returning the first
 * `.ce-line` element or `NO_SELECTION` when the walk runs off the document.
 *
 * @param start - DFS root; usually the click target node
 *
 * @returns enclosing `.ce-line` element or `NO_SELECTION`
 *
 * @example
 * ```ts
 * const line = findEnclosingLine(selection.anchorNode);
 * ```
 */
function findEnclosingLine(start: Node,): HTMLElement | typeof NO_SELECTION {
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- parser cursor: `runner` advances up the parent chain until the `.ce-line` host is found or the walk reaches the document root */
  /**
   * Walks parent chain looking for the enclosing `.ce-line` element.
   */
  let runner: Node = start;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  while (true) {
    if (
      (runner instanceof HTMLElement)
        && runner
        .classList
        .contains('ce-line',)
    ) {
      return runner;
    }
    /**
     * Next ancestor; DOM `parentNode` yields `null` at the document root.
     */
    const parent = runner.parentNode;
    if (parent === null)
      return NO_SELECTION;
    runner = parent;
  }
}

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
   * @returns absolute buffer offset or `NO_SELECTION`
   */
  function domToOffset(
    domInput: {
      node: Node;
      offset: number;
    },
  ): number | typeof NO_SELECTION {
    /**
     * Enclosing `.ce-line` element; `NO_SELECTION` exits early to leave the selection unresolved.
     */
    const line = findEnclosingLine(domInput.node,);
    if (line === NO_SELECTION)
      return NO_SELECTION;
    /**
     * Parsed line index from the enclosing element's `data-line` attribute.
     */
    const lineIndex = Number.parseInt(
      line.dataset
        .line
        ?? '',
      10,
    );
    if (Number.isNaN(lineIndex,))
      return NO_SELECTION;
    // Sum the lengths of preceding lines (with a trailing newline
    // each) plus the offset within the current line. We use the
    // surface's textContent to recover line lengths since the line's
    // textContent matches the buffer slice the viewport rendered.
    /**
     * Materialised line list so the walk can compare indices and break early.
     */
    const lines = [
      ...input.surface
        .querySelectorAll<HTMLElement>('.ce-line',),
    ];
    /**
     * Sum of preceding-line lengths plus newlines; runs over `lines` and stops at `lineIndex`.
     */
    const absolute = lines.reduce(
      function sumPrecedingLineLengths(
        acc,
        candidate,
      ) {
        /**
         * Parsed line index of the candidate; comparison with `lineIndex` decides whether to stop.
         */
        const candidateIndex = Number.parseInt(
          candidate.dataset
            .line
            ?? '',
          10,
        );
        if (Number.isNaN(candidateIndex,)
          || (candidateIndex >= lineIndex))
          return acc;
        return acc + (candidate.textContent
          ?? '')
          .length
          + 1;
      },
      0,
    );
    /**
     * Tallies code-unit lengths of text nodes preceding the target
     * `(node, offset)`. Uses a recursive DFS with closure-scoped state
     * that exits the walk once `domInput.node` is reached.
     *
     * @param root - DFS root; the enclosing line element to walk into
     *
     * @returns running tally inside the target line
     */
    function tallyWithinLine(root: HTMLElement,): number {
      /**
       * Running tally inside the target line; finalised when the DFS hits the target node.
       */
      let withinLine = 0;
      /**
       * DFS sentinel; flipped once the target node is reached so later nodes are skipped.
       */
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
        if (node === domInput
          .node) {
          withinLine += domInput.offset;
          foundTarget = true;
          return;
        }
        if (node.nodeType
          === Node
          .TEXT_NODE) {
          withinLine += (node.textContent
            ?? '').length;
          return;
        }
        for (const child of node.childNodes)
          walk(child,);
      }
      walk(root,);
      return withinLine;
    }
    return absolute + tallyWithinLine(line,);
  }

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- coordinator cache: `cached` is recomputed by the `selectionchange` listener and read by `getRange()` so consumers see the latest translation without paying for an inner-walk per read */
  /**
   * Cache of the most recent selection in surface-local offsets.
   */
  let cached: {
    from: number;
    to: number;
  } | typeof NO_SELECTION = NO_SELECTION;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  /**
   * Reads the current `document.getSelection()` and translates it into
   * buffer offsets in `cached`. Sets `cached` to `null` when the
   * selection is not inside the editor surface.
   */
  function refresh(): void {
    /**
     * Browser-managed selection; null when no selection or no document scope.
     */
    const sel = document.getSelection();
    if ((sel === null) || (sel.rangeCount
      === 0)) {
      cached = NO_SELECTION;
      return;
    }
    /**
     * First range; the editor uses single-range selections only.
     */
    const range = sel.getRangeAt(0,);
    if (!input.surface
      .contains(range.startContainer,)) {
      cached = NO_SELECTION;
      return;
    }
    /**
     * Start offset translated from DOM coordinates.
     */
    const from = domToOffset({
      node: range.startContainer,
      offset: range.startOffset,
    },);
    /**
     * End offset translated from DOM coordinates.
     */
    const to = domToOffset({
      node: range.endContainer,
      offset: range.endOffset,
    },);
    if ((from === NO_SELECTION) || (to === NO_SELECTION)) {
      cached = NO_SELECTION;
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
   * @returns DOM position or `NO_SELECTION` if no matching line is rendered
   */
  function offsetToDom(
    target: { offset: number; },
  ): {
    node: Node;
    offset: number;
  } | typeof NO_SELECTION {
    /**
     * Materialised line list so the walk can break out as soon as the target is bracketed.
     */
    const lines = [
      ...input.surface
        .querySelectorAll<HTMLElement>('.ce-line',),
    ];
    /* oxlint-disable no-restricted-syntax/no-function-root-let -- parser cursor: `cursor` is the running buffer offset advanced by line-length + 1 per iteration and read inside the loop body to decide whether the target falls in the current line */
    /**
     * Running buffer offset; advances by line length + 1 (newline) per iteration.
     */
    let cursor = 0;
    /* oxlint-enable no-restricted-syntax/no-function-root-let */
    for (const line of lines) {
      /**
       * Current line's character length, derived from its rendered text content.
       */
      const lineLength = (line.textContent
        ?? '').length;
      /**
       * Buffer offset where this line ends (exclusive of trailing newline).
       */
      const lineEnd = cursor + lineLength;
      if (target.offset
        <= lineEnd) {
        /**
         * First child as the preferred text node; falls back to the line element when missing.
         */
        const text = line.firstChild;
        if ((text !== null) && (text.nodeType
          === Node
          .TEXT_NODE)) {
          return {
            node: text,
            offset: target.offset
              - cursor,
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
    return NO_SELECTION;
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
      /**
       * Resolved DOM start position; `NO_SELECTION` aborts the set so a stale Range is not written.
       */
      const start = offsetToDom({ offset: target.from, },);
      /**
       * Resolved DOM end position; `NO_SELECTION` aborts the set so a stale Range is not written.
       */
      const end = offsetToDom({ offset: target.to, },);
      if ((start === NO_SELECTION) || (end === NO_SELECTION))
        return;
      /**
       * Browser-managed selection; null aborts the set when no document scope is available.
       */
      const sel = document.getSelection();
      if (sel === null)
        return;
      /**
       * Fresh Range covering the resolved start and end; replaces the existing selection.
       */
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
      cached = NO_SELECTION;
    },
  };
}
