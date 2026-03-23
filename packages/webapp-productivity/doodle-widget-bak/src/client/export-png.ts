/**
 * PNG export for the doodle widget.
 *
 * Renders all layers (background, strokes, text) as a rasterized
 * PNG image and triggers a download.
 */

import {
  renderBaseCanvas,
  triggerDownload,
  type ExportDeps,
} from './export.ts';

//region Constants

/** Font size for text inputs in rem, matching `.text-input` CSS */
const TEXT_FONT_SIZE_REM = 1.25;

/** Fallback pixels-per-rem when computed root font size is unavailable */
const DEFAULT_ROOT_FONT_SIZE_PX = 16;

/** Divisor for converting percentage positions to the 0..1 range */
const PERCENT_DIVISOR = 100;

/** Text color matching `.text-input` CSS */
const TEXT_COLOR = 'oklch(0.3 0 0)';

//endregion Constants

/**
 * Exports the doodle as a PNG file.
 *
 * Composites background, strokes, and text onto a single canvas,
 * then triggers a PNG download.
 *
 * @param deps - shared export dependencies
 *
 * @example
 * ```ts
 * await exportAsPng({ container, overlay, drawCanvas, textLayer });
 * ```
 */
export async function exportAsPng(deps: ExportDeps,): Promise<void> {
  const { container, textLayer, } = deps;
  /** Container width in CSS pixels */
  const cw = container.clientWidth;
  /** Container height in CSS pixels */
  const ch = container.clientHeight;

  const { canvas, ctx, } = await renderBaseCanvas(deps,);

  //region Layer 4: text annotations
  /** Default text font size in pixels for inputs without data attributes */
  const rootFontSize = Number.parseFloat(
    getComputedStyle(document.documentElement,).fontSize,
  ) || DEFAULT_ROOT_FONT_SIZE_PX;
  const defaultFontSizePx = TEXT_FONT_SIZE_REM * rootFontSize;
  ctx.textBaseline = 'top';

  /** All text input elements (active and readonly) */
  const textInputs = textLayer.querySelectorAll<HTMLInputElement>('.text-input',);
  for (const input of textInputs) {
    if (input.value.trim() === '')
      continue;
    /** Per-input font size, falling back to CSS default */
    const fontSizePx = input.dataset.fontSize !== undefined
      ? Number.parseFloat(input.dataset.fontSize,)
      : defaultFontSizePx;
    /** Per-input color, falling back to CSS default */
    const color = input.dataset.color ?? TEXT_COLOR;
    ctx.font = `${String(fontSizePx,)}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    /** Horizontal position as percentage */
    const xPercent = Number.parseFloat(input.style.insetInlineStart,);
    /** Vertical position as percentage */
    const yPercent = Number.parseFloat(input.style.insetBlockStart,);
    ctx.fillText(
      input.value,
      (xPercent / PERCENT_DIVISOR) * cw,
      (yPercent / PERCENT_DIVISOR) * ch,
    );
  }
  //endregion Layer 4

  const blob = await canvas.convertToBlob({ type: 'image/png', },);
  triggerDownload({ blob, filename: 'doodle.png', },);
}
