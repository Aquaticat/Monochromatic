/**
 * Post-layout measurement for inlay hint positioning.
 *
 * After `::before` hints are rendered, measures the `::before` height
 * and sets `--line-num-offset` so line numbers align with the code text.
 *
 * Also provides {@link measureSpaceRatio} to compute how many Inter spaces
 * equal one JetBrains Mono character width, so leading-space indentation
 * in the proportional-font `::before` aligns with the monospace code.
 */

/**
 * Module-scoped measurement cache filled by {@link measureSpaceRatio}.
 *
 * - `ratio`: mono-to-Inter space-width ratio; `null` until first measured.
 * - `ctx`: canvas context retained with the Inter font for later `measureText` calls.
 * - `monoW`: JetBrains Mono character width in pixels.
 * - `interSpW`: Inter space-character width in pixels (divisor for gap computation).
 *
 * Held in a single `const` container so the cache lives at module scope without
 * a module-root `let` (no-module-root-let rule).
 */
const cache: {
  ratio: number | null;
  ctx: CanvasRenderingContext2D | null;
  monoW: number;
  interSpW: number;
} = {
  ratio: null,
  ctx: null,
  monoW: 0,
  interSpW: 0,
};

/**
 * Computes the ratio `monoSpaceWidth / interSpaceWidth` so that
 * `Math.round(charOffset * ratio)` Inter spaces span the same pixel
 * width as `charOffset` JetBrains Mono characters.
 *
 * Measured once via an off-screen canvas and cached for the session.
 *
 * @param editor - editor element whose computed font-size is used for measurement
 *
 * @returns space count multiplier (defaults to 1 if canvas is unavailable)
 *
 * @example
 * ```ts
 * const result = measureSpaceRatio({ editor: editor, });
 * ```
 */
export function measureSpaceRatio({ editor, }: { readonly editor: HTMLElement; },): number {
  if (cache.ratio
    !== null)
    return cache.ratio;

  /**
   * Without destructuring: prefer-destructuring lint error for member access.
   */
  const { fontSize, } = getComputedStyle(editor,);
  /**
   * Off-screen canvas used purely for text measurement; never attached to the document.
   */
  const canvas = document.createElement('canvas',);
  /**
   * 2D context whose `measureText` reports glyph widths under each font we probe.
   */
  const ctx = canvas.getContext('2d',);
  if (ctx === null) {
    cache.ratio = 1;
    return 1;
  }

  ctx.font = `${fontSize} 'JetBrains Mono', monospace`;
  /**
   * Width of a single space rendered in JetBrains Mono at the editor's font size.
   */
  const monoSpace = ctx.measureText(' ',)
    .width;

  ctx.font = `${fontSize} 'Inter', sans-serif`;
  /**
   * Width of a single space rendered in Inter at the same font size, used as the divisor.
   */
  const interSpace = ctx.measureText(' ',)
    .width;

  cache.ratio = interSpace > 0 ? monoSpace / interSpace : 1;
  cache.monoW = monoSpace;
  cache.interSpW = interSpace;
  /**
   * Retain context with Inter font for {@link measureInterText}.
   */
  cache.ctx = ctx;
  return cache.ratio;
}

/**
 * Computes how many Inter spaces to insert before a hint at `charPos`,
 * given that `rowText` (in Inter) already occupies the row.
 *
 * Measures the actual pixel width of `rowText` via canvas, then computes
 * how many Inter spaces bridge the remaining distance to the target
 * monospace column. This avoids the assumption that label characters
 * in Inter have the same width as monospace characters or Inter spaces.
 *
 * Falls back to `Math.round((charPos - fallbackCursor) * spaceRatio)`
 * when canvas state is unavailable.
 *
 * @param charPos - target character column in monospace units
 *
 * @param rowText - current row content (Inter spaces + labels)
 *
 * @param fallbackCursor - cursor position for fallback (monospace character units)
 *
 * @param spaceRatio - mono-to-inter space width ratio
 *
 * @returns number of Inter spaces to insert
 *
 * @example
 * ```ts
 * const result = interSpacesForGap({ charPos: 10, rowText: 'const x = 42;', fallbackCursor: 0, spaceRatio: 0.6, });
 * ```
 */
export function interSpacesForGap({
  charPos,
  rowText,
  fallbackCursor,
  spaceRatio,
}: {
  readonly charPos: number;
  readonly rowText: string;
  readonly fallbackCursor: number;
  readonly spaceRatio: number;
},): number {
  if ((cache.ctx
    === null) || (cache.monoW
      === 0)
    || (cache.interSpW
      === 0))
    return Math.round((charPos - fallbackCursor) * spaceRatio,);

  /**
   * Pixel column the hint should land on, derived from the monospace character offset.
   */
  const targetPx = charPos * cache
    .monoW;
  /**
   * Actual pixel width the existing Inter-rendered row already occupies.
   */
  const rowPx = cache.ctx
    .measureText(rowText,)
    .width;
  /**
   * Number of Inter spaces that bridge the remaining gap; clamped at zero for short rows.
   */
  const gap = Math.max(
    0,
    Math.round((targetPx - rowPx) / cache
      .interSpW,),
  );
  return gap;
}

/**
 * Measures each annotated div's `::before` height and sets `--line-num-offset`
 * so the line number aligns with the code text below the annotation rows.
 *
 * Must be called after layout (e.g. in a follow-up requestAnimationFrame).
 *
 * @param editor - contenteditable container element
 *
 * @example
 * ```ts
 * measureInlayOffsets({ editor: editor, });
 * ```
 */
export function measureInlayOffsets({ editor, }: { readonly editor: HTMLElement; },): void {
  for (const child of editor.children) {
    if ((!(child instanceof HTMLElement)) || (child.dataset
      .inlay
      === undefined))
      continue;

    /**
     * Rendered height of the `::before` annotation; drives the line-number offset variable.
     */
    const beforeHeight = getComputedStyle(
      child,
      '::before',
    )
      .height;
    if ((beforeHeight !== 'auto') && (beforeHeight !== '0px')) {
      child.style
        .setProperty(
        '--line-num-offset',
        beforeHeight,
      );
    }
  }
}
