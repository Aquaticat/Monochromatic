/**
 * Editor viewport.
 *
 * Renders only the lines currently visible inside the host's
 * scrollable region. The renderer is line-oriented (one DOM node per
 * line) with a uniform line height; long lines scroll horizontally
 * rather than wrapping, matching plan §1's deliberate scope cut.
 *
 * The viewport keeps its own line index -- a sorted array of `0`-
 * relative line-start offsets -- recomputed on every `render`. For the
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

/** Estimated line height in pixels; falls back if the surface is detached. */
const ESTIMATED_LINE_HEIGHT_PX = 20;

/** Padding lines rendered above and below the visible window. */
const OVERSCAN_LINES = 5;

/** Fallback viewport height in pixels when the host is not yet laid out. */
const FALLBACK_VIEWPORT_HEIGHT_PX = 400;

/** Result of `mountViewport`. */
export type Viewport = {
  /** The contenteditable surface the input layer binds to. */
  readonly surface: HTMLElement;
  /** Re-render after the buffer has changed. */
  render(text: string,): void;
  /** Detach from the host and remove the viewport DOM. */
  destroy(): void;
  /** Convert a buffer offset to a (line, col) pair for selection placement. */
  offsetToLineCol(offset: number,): {
    line: number;
    col: number;
  };
  /** Convert a (line, col) pair back to a buffer offset. */
  lineColToOffset(input: {
    line: number;
    col: number;
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
  input.host.classList.add('ce-host',);
  const spacer = document.createElement('div',);
  spacer.className = 'ce-spacer';
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
  input.host.append(spacer,);

  /** Sorted array of line-start offsets; element 0 is always `0`. */
  let lineStarts: number[] = [
    0,
  ];

  /** Cached full text the viewport last rendered against. */
  let lastText = '';

  /** Pixel height per line; measured once after the first render. */
  let lineHeight = ESTIMATED_LINE_HEIGHT_PX;

  /**
   * Rebuilds `lineStarts` from `text`. O(text.length); called from
   * `render` so every change reflects in the index.
   *
   * @param text - the current buffer
   */
  function rebuildLineStarts(text: string,): void {
    const starts: number[] = [
      0,
    ];
    for (let index = 0; index < text.length; index += 1) {
      if (text.codePointAt(index,) === /* '\n' */ 10)
        starts.push(index + 1,);
    }
    lineStarts = starts;
  }

  /**
   * Re-renders the visible window. Computes which lines fall inside
   * the host's scroll viewport (with overscan) and writes those into
   * the surface as absolutely-positioned `<div class="ce-line">`s.
   *
   * @param text - current buffer text
   */
  function render(text: string,): void {
    lastText = text;
    rebuildLineStarts(text,);

    spacer.style.minBlockSize = `${String(lineStarts.length * lineHeight,)}px`;

    const hostRect = input.host.getBoundingClientRect();
    const { scrollTop, } = input.host;
    const visibleHeight = hostRect.height > 0
      ? hostRect.height
      : FALLBACK_VIEWPORT_HEIGHT_PX;
    const firstVisible = Math.max(
      0,
      Math.floor(scrollTop / lineHeight,) - OVERSCAN_LINES,
    );
    const lastVisible = Math.min(
      lineStarts.length - 1,
      Math.ceil((scrollTop + visibleHeight) / lineHeight,) + OVERSCAN_LINES,
    );

    const fragment = document.createDocumentFragment();
    for (let line = firstVisible; line <= lastVisible; line += 1) {
      const start = lineStarts[line];
      if (start === undefined)
        continue;
      const end = line + 1 < lineStarts.length
        // The next line's start minus the trailing newline.
        ? (lineStarts[line + 1] ?? text.length) - 1
        : text.length;
      const lineDiv = document.createElement('div',);
      lineDiv.className = 'ce-line';
      lineDiv.dataset['line'] = String(line,);
      lineDiv.style.position = 'absolute';
      lineDiv.style.insetBlockStart = `${String(line * lineHeight,)}px`;
      lineDiv.style.insetInlineStart = '0';
      lineDiv.style.inlineSize = '100%';
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
    const firstLine = surface.querySelector<HTMLElement>('.ce-line',);
    if (firstLine !== null) {
      const measured = firstLine.getBoundingClientRect().height;
      if (measured > 0 && Math.abs(measured - lineHeight,) > 1)
        lineHeight = measured;
    }
  }

  /** Re-renders on host scroll so virtualisation actually virtualises. */
  function onScroll(): void {
    render(lastText,);
  }
  input.host.addEventListener(
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
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      const start = lineStarts[mid];
      if (start === undefined || start > offset)
        hi = mid - 1;
      else
        lo = mid;
    }
    return {
      line: lo,
      col: offset - (lineStarts[lo] ?? 0),
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
      line: number;
      col: number;
    },
  ): number {
    const clampedLine = Math.max(
      0,
      Math.min(
        target.line,
        lineStarts.length - 1,
      ),
    );
    const lineStart = lineStarts[clampedLine] ?? 0;
    const nextStart = clampedLine + 1 < lineStarts.length
      ? (lineStarts[clampedLine + 1] ?? lastText.length) - 1
      : lastText.length;
    const lineLength = nextStart - lineStart;
    return lineStart + Math.max(
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
      input.host.removeEventListener(
        'scroll',
        onScroll,
      );
      spacer.remove();
      input.host.classList.remove('ce-host',);
    },
  };
}
