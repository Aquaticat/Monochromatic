/**
 * Editor viewport.
 *
 * Renders only the lines currently visible inside the host's
 * scrollable region. The renderer is line-oriented (one DOM node per
 * line) with a uniform line height; long lines scroll horizontally
 * rather than wrapping, matching plan §1's deliberate scope cut.
 *
 * The viewport keeps its own line index; a sorted array of `0`-
 * relative line-start offsets; recomputed on every `render`. For the
 * demo's tier-3 ceiling (256 KB per chunk, ~10 KB lines worst case)
 * the index is well under 5 K entries, so the O(n) recompute on each
 * change is acceptable. A future optimisation could maintain it
 * incrementally inside the worker.
 *
 * The host element gains:
 *
 *   <div class="ce-host">
 *     <div class="ce-spacer">         <-- height = totalLines * lineHeight
 *       <div class="ce-surface" contenteditable="plaintext-only">
 *         <div class="ce-line">...</div>     <-- only visible lines
 *         <div class="ce-line">...</div>
 *       </div>
 *     </div>
 *   </div>
 *
 * The `ce-surface` is the contenteditable target the input layer
 * binds to; the spacer carries the scroll height.
 */

/**
 * Estimated line height in pixels; falls back if the surface is detached.
 */
const ESTIMATED_LINE_HEIGHT_PX = 20;

/**
 * Padding lines rendered above and below the visible viewport span.
 */
const OVERSCAN_LINES = 5;

/**
 * Fallback viewport height in pixels when the host is not yet laid out.
 */
const FALLBACK_VIEWPORT_HEIGHT_PX = 400;

/**
 * Result of `mountViewport`.
 */
export type Viewport = {
  /**
   * The contenteditable surface the input layer binds to.
   */
  readonly surface: HTMLElement;
  /**
   * Re-render after the buffer has changed.
   */
  render(text: string,): void;
  /**
   * Detach from the host and remove the viewport DOM.
   */
  destroy(): void;
  /**
   * Convert a buffer offset to a (line, col) pair for selection placement.
   */
  offsetToLineCol(offset: number,): {
    readonly line: number;
    readonly col: number;
  };
  /**
   * Convert a (line, col) pair back to a buffer offset.
   */
  lineColToOffset(input: {
    readonly line: number;
    readonly col: number;
  },): number;
};


/**
 * Mounts the viewport DOM into `host` and renders `initialText`.
 *
 * @param input - host element and initial buffer text
 *
 * @returns viewport handle with render/destroy and offset helpers
 *
 * @example
 * ```ts
 * const viewport = mountViewport({ host, initialText: '' });
 * viewport.render('hello\nworld');
 * ```
 */
export function mountViewport(
  input: {
    host: HTMLElement;
    initialText: string;
  },
): Viewport {
  input.host
    .classList
    .add('ce-host',);
  /**
   * Spacer node that carries the total scroll height for virtualisation.
   */
  const spacer = document.createElement('div',);
  spacer.className = 'ce-spacer';
  /**
   * Contenteditable surface the input layer binds to and the viewport repaints into.
   */
  const surface = document.createElement('div',);
  surface.className = 'ce-surface';
  surface.setAttribute(
    'contenteditable',
    'plaintext-only',
  );
  surface.setAttribute(
    'spellcheck',
    'false',
  );
  spacer.append(surface,);
  input.host
    .append(spacer,);

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- coordinator state: `lineStarts` is rebuilt by `rebuildLineStarts` on every render; `lastText` caches the most recent buffer for diff-skipping; `lineHeight` is overwritten once after the first render measures the actual layout */
  /**
   * Sorted array of line-start offsets; element 0 is always `0`.
   */
  let lineStarts: number[] = [
    0,
  ];

  /**
   * Cached full text the viewport last rendered against.
   */
  let lastText = '';

  /**
   * Pixel height per line; measured once after the first render.
   */
  let lineHeight = ESTIMATED_LINE_HEIGHT_PX;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  /**
   * Rebuilds `lineStarts` from `text`. O(text.length); called from
   * `render` so every change reflects in the index.
   *
   * @param text - the current buffer
   */
  function rebuildLineStarts(text: string,): void {
    /**
     * Local buffer built in one pass and assigned to `lineStarts` once complete.
     */
    const starts: number[] = [
      0,
    ];
    for (let loopIndex = 0; loopIndex < text
      .length; loopIndex += 1) {
      if (text
        .codePointAt(loopIndex,)
        === /* '\n' */ 10)
        starts.push(loopIndex + 1,);
    }
    lineStarts = starts;
  }

  /**
   * Re-renders the visible viewport span. Computes which lines fall inside
   * the host's scroll viewport (with overscan) and writes those into
   * the surface as absolutely-positioned `<div class="ce-line">`s.
   *
   * @param text - current buffer text
   */
  function render(text: string,): void {
    lastText = text;
    rebuildLineStarts(text,);

    spacer.style
      .minBlockSize = `${String(lineStarts.length
        * lineHeight,)}px`;

    /**
     * Cached layout rect; read once per render to avoid forcing a second layout per line.
     */
    const hostRect = input.host
      .getBoundingClientRect();
    /**
     * Current vertical scroll position; informs the visible-window slice below.
     */
    const { scrollTop, } = input.host;
    /**
     * Visible viewport height in pixels; falls back when the host has zero height (not laid out yet).
     */
    const visibleHeight = hostRect.height
      > 0
      ? hostRect.height
      : FALLBACK_VIEWPORT_HEIGHT_PX;
    /**
     * First line index inside the rendered window (overscanned above).
     */
    const firstVisible = Math.max(
      0,
      Math.floor(scrollTop / lineHeight,)
        - OVERSCAN_LINES,
    );
    /**
     * Last line index inside the rendered window (overscanned below).
     */
    const lastVisible = Math.min(
      lineStarts.length
        - 1,
      Math.ceil((scrollTop + visibleHeight) / lineHeight,)
        + OVERSCAN_LINES,
    );

    /**
     * Off-screen fragment so the surface only takes one DOM mutation when committed.
     */
    const fragment = document.createDocumentFragment();
    for (let line = firstVisible; line <= lastVisible; line += 1) {
      /**
       * Buffer offset where this line starts; skip when the index is out of range.
       */
      const start = lineStarts[line];
      if (start === undefined)
        continue;
      /**
       * Buffer offset where this line ends; uses the next line's start minus the trailing newline.
       */
      const end = (line + 1) < lineStarts
        .length
        // The next line's start minus the trailing newline.
        ? (lineStarts[line + 1]
          ?? text
          .length) - 1
        : text.length;
      /**
       * One absolutely-positioned `<div>` per visible line; appended to the fragment.
       */
      const lineDiv = document.createElement('div',);
      lineDiv.className = 'ce-line';
      lineDiv.dataset
        .line = String(line,);
      lineDiv.style
        .position = 'absolute';
      lineDiv.style
        .insetBlockStart = `${String(line * lineHeight,)}px`;
      lineDiv.style
        .insetInlineStart = '0';
      lineDiv.style
        .inlineSize = '100%';
      lineDiv.textContent = text.slice(
        start,
        end,
      );
      fragment.append(lineDiv,);
    }

    surface.replaceChildren(fragment,);

    // Measure line height after the first render so subsequent renders
    // size the spacer accurately. We only re-measure when the value
    // diverges materially.
    /**
     * Sampled line element used to refine `lineHeight` after the first layout pass.
     */
    const firstLine = surface.querySelector<HTMLElement>('.ce-line',);
    if (firstLine !== null) {
      /**
       * Live measurement; replaces `lineHeight` only when the divergence is material.
       */
      const measured = firstLine.getBoundingClientRect()
        .height;
      if ((measured > 0) && (Math.abs(measured - lineHeight,)
        > 1))
        lineHeight = measured;
    }
  }

  /**
   * Re-renders on host scroll so virtualisation actually virtualises.
   */
  function onScroll(): void {
    render(lastText,);
  }
  input.host
    .addEventListener(
    'scroll',
    onScroll,
    { passive: true, },
  );

  /**
   * Maps a buffer offset to a `(line, col)` pair via the line index.
   *
   * @param offset - 0-based buffer offset
   *
   * @returns `(line, col)` such that `lineStarts[line] + col === offset`
   */
  function offsetToLineCol(offset: number,): {
    line: number;
    col: number;
  } {
    /* oxlint-disable no-restricted-syntax/no-function-root-let -- binary search state machine: `lo` and `hi` converge to the target line index by mid-point bisection; both must be reassigned each iteration to maintain the invariant */
    /**
     * Binary-search lower bound; converges with `hi` to the target line index.
     */
    let lo = 0;
    /**
     * Binary-search upper bound; capped at the highest known line index.
     */
    let hi = lineStarts.length
      - 1;
    /* oxlint-enable no-restricted-syntax/no-function-root-let */
    while (lo < hi) {
      /**
       * Midpoint biased upward so the loop terminates with `lo === hi`.
       */
      const mid = (lo + hi
        + 1) >>> 1;
      /**
       * Probe value at `mid`; undefined signals a stale index and pushes `hi` down.
       */
      const start = lineStarts[mid];
      if ((start === undefined) || (start > offset))
        hi = mid - 1;
      else
        lo = mid;
    }
    return {
      line: lo,
      col: offset - (lineStarts[lo]
        ?? 0),
    };
  }

  /**
   * Inverse of `offsetToLineCol`. Clamps `col` to the line's length.
   *
   * @param target - `(line, col)` to convert
   *
   * @returns buffer offset
   */
  function lineColToOffset(
    target: {
      readonly line: number;
      readonly col: number;
    },
  ): number {
    /**
     * Clamped line index so out-of-range inputs collapse to the nearest valid line.
     */
    const clampedLine = Math.max(
      0,
      Math.min(
        target.line,
        lineStarts.length
          - 1,
      ),
    );
    /**
     * Buffer offset where the clamped line starts.
     */
    const lineStart = lineStarts[clampedLine]
      ?? 0;
    /**
     * Buffer offset where the clamped line ends; uses next-start minus trailing newline.
     */
    const nextStart = (clampedLine + 1) < lineStarts
      .length
      ? (lineStarts[clampedLine + 1]
        ?? lastText
        .length) - 1
      : lastText.length;
    /**
     * Character width of the clamped line; used to clamp `target.col`.
     */
    const lineLength = nextStart - lineStart;
    return lineStart + Math
      .max(
      0,
      Math.min(
        target.col,
        lineLength,
      ),
    );
  }

  // First paint with the seed text.
  render(input.initialText,);

  return {
    surface,
    render,
    offsetToLineCol,
    lineColToOffset,
    destroy() {
      input.host
        .removeEventListener(
        'scroll',
        onScroll,
      );
      spacer.remove();
      input.host
        .classList
        .remove('ce-host',);
    },
  };
}
