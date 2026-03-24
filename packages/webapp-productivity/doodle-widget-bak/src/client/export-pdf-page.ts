/**
 * Per-page canvas compositing for PDF export.
 *
 * Renders a single page's layers (white background, strokes, SVG)
 * to an offscreen canvas at device pixel resolution for sharp
 * PDF embedding.
 */

import type { StrokeData, } from './drawing.ts';
import {
  renderStrokesToContext,
  renderSvgOverlayToContext,
} from './export.ts';

/**
 * Renders a single page's layers to an offscreen canvas.
 *
 * Composites white background, strokes (behind), and SVG linework
 * (on top) at device pixel resolution. The SVG overlay element is
 * temporarily set to the page's background markup for CSS layout
 * computation via `getBoundingClientRect`.
 *
 * @param cw - container width in CSS pixels
 *
 * @param ch - container height in CSS pixels
 *
 * @param svgBackground - SVG overlay innerHTML for this page
 *
 * @param strokes - stroke data for this page
 *
 * @param container - canvas container for SVG position reference
 *
 * @param overlay - SVG overlay element (innerHTML is temporarily modified)
 *
 * @returns composited offscreen canvas at device pixel resolution
 *
 * @example
 * ```ts
 * const canvas = await renderPageCanvas({
 *   cw: 800, ch: 600,
 *   svgBackground: '<svg>...</svg>',
 *   strokes: pageStrokes,
 *   container, overlay,
 * });
 * ```
 */
export async function renderPageCanvas(
  { cw, ch, svgBackground, strokes, container, overlay, }: {
    cw: number;
    ch: number;
    svgBackground: string;
    strokes: readonly StrokeData[];
    container: HTMLDivElement;
    overlay: HTMLDivElement;
  },
): Promise<OffscreenCanvas> {
  /** Set overlay to this page's SVG for layout computation */
  overlay.innerHTML = svgBackground;

  /** Device pixel ratio for high-DPI rendering */
  const dpr = globalThis.devicePixelRatio;
  const exportCanvas = new OffscreenCanvas(cw * dpr, ch * dpr,);
  /** 2D context for the page export canvas */
  const maybeCtx = exportCanvas.getContext('2d',);
  if (maybeCtx === null)
    throw new Error('Export canvas 2D context unavailable',);
  const ctx = maybeCtx;

  /** Scale context so all drawing uses CSS pixel coordinates */
  ctx.scale(dpr, dpr,);

  //region Layer 1: white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, cw, ch,);
  //endregion Layer 1

  //region Layer 2: strokes (behind SVG linework)
  renderStrokesToContext({ ctx, cw, ch, strokes, },);
  //endregion Layer 2

  //region Layer 3: SVG on top (rasterized at device resolution)
  await renderSvgOverlayToContext({ ctx, container, overlay, imageScale: dpr, },);
  //endregion Layer 3

  return exportCanvas;
}
