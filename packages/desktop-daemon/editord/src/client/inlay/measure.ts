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

/** Cached ratio of mono character width to Inter space width. */
let cachedRatio: number | null = null;

/** Cached canvas context (Inter font) and mono character width for label measurement. */
let cachedCtx: CanvasRenderingContext2D | null = null;
/** Cached JetBrains Mono character width in pixels, measured once via off-screen canvas. */
let cachedMonoW = 0;
/** Cached Inter space character width in pixels, measured once via off-screen canvas. */
let cachedInterSpW = 0;

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
export function measureSpaceRatio({ editor, }: { editor: HTMLElement; },): number {
  if (cachedRatio !== null)
    return cachedRatio;

  /** Without destructuring: prefer-destructuring lint error for member access. */
  const { fontSize, } = getComputedStyle(editor,);
  const canvas = document.createElement('canvas',);
  const ctx = canvas.getContext('2d',);
  if (ctx === null) {
    cachedRatio = 1;
    return 1;
  }

  ctx.font = `${fontSize} 'JetBrains Mono', monospace`;
  const monoSpace = ctx.measureText(' ',).width;

  ctx.font = `${fontSize} 'Inter', sans-serif`;
  const interSpace = ctx.measureText(' ',).width;

  cachedRatio = interSpace > 0 ? monoSpace / interSpace : 1;
  cachedMonoW = monoSpace;
  cachedInterSpW = interSpace;
  /** Retain context with Inter font for {@link measureInterText}. */
  cachedCtx = ctx;
  return cachedRatio;
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
  charPos: number;
  rowText: string;
  fallbackCursor: number;
  spaceRatio: number;
},): number {
  if (cachedCtx === null || cachedMonoW === 0 || cachedInterSpW === 0)
    return Math.round((charPos - fallbackCursor) * spaceRatio,);

  const targetPx = charPos * cachedMonoW;
  const rowPx = cachedCtx.measureText(rowText,).width;
  const gap = Math.max(
    0,
    Math.round((targetPx - rowPx) / cachedInterSpW,),
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
export function measureInlayOffsets({ editor, }: { editor: HTMLElement; },): void {
  for (const child of editor.children) {
    if (!(child instanceof HTMLElement) || child.dataset.inlay === undefined)
      continue;

    const beforeHeight = getComputedStyle(
      child,
      '::before',
    )
      .height;
    if (beforeHeight !== 'auto' && beforeHeight !== '0px') {
      child.style.setProperty(
        '--line-num-offset',
        beforeHeight,
      );
    }
  }
}
