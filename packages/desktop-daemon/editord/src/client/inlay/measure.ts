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
 */
export function measureSpaceRatio({ editor, }: { editor: HTMLElement }): number {
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
  return cachedRatio;
}

/**
 * Measures each annotated div's `::before` height and sets `--line-num-offset`
 * so the line number aligns with the code text below the annotation rows.
 *
 * Must be called after layout (e.g. in a follow-up requestAnimationFrame).
 *
 * @param editor - contenteditable container element
 */
export function measureInlayOffsets({ editor, }: { editor: HTMLElement }): void {
  for (const child of editor.children) {
    if (!(child instanceof HTMLElement) || child.dataset.inlay === undefined)
      continue;

    const beforeHeight = getComputedStyle(child, '::before',).height;
    if (beforeHeight !== 'auto' && beforeHeight !== '0px') {
      child.style.setProperty('--line-num-offset', beforeHeight,);
    }
  }
}
