/**
 * Export facade and shared utilities for the doodle widget.
 *
 * Provides shared types, canvas compositing for raster-based exports
 * (PNG, PDF), and a common download trigger. Format-specific export
 * functions live in dedicated modules.
 *
 * Exceeds 100 lines: shared compositing, download utility, stroke/SVG
 * rendering helpers, and type definitions are tightly coupled export
 * infrastructure that cannot be meaningfully split further.
 */

import { getStrokes, } from './drawing.ts';
import { requireOffscreenContext, } from './require-context.ts';
import { renderStrokes, } from './stroke-renderer.ts';
import { measureSvgOverlay, } from './svg-overlay-measure.ts';

//region Types

/** Supported export format */
export type ExportFormat = 'pdf' | 'png' | 'svg';

/**
 * Shared dependencies for all export functions.
 *
 * @example
 * ```ts
 * const deps: ExportDeps = { container, overlay, drawCanvas, textLayer };
 * await exportAsPng(deps);
 * ```
 */
export type ExportDeps = {
  /** Canvas container element for sizing and coordinate reference */
  readonly container: HTMLDivElement;
  /** SVG overlay div holding the background SVG element */
  readonly overlay: HTMLDivElement;
  /** Canvas element with rendered strokes */
  readonly drawCanvas: HTMLCanvasElement;
  /** Div containing positioned text input elements */
  readonly textLayer: HTMLDivElement;
};

//endregion Types

/**
 * Reads the container's CSS pixel dimensions.
 *
 * @param container - canvas container element
 *
 * @returns width and height as `cw` and `ch`
 */
export function getContainerSize(container: HTMLDivElement,): { cw: number; ch: number; } {
  return { cw: container.clientWidth, ch: container.clientHeight, };
}

/**
 * Renders the SVG overlay element onto a 2D canvas context.
 *
 * Reads the live SVG element from the overlay div, clones it with
 * explicit dimensions, serializes to a data URL, and draws it at
 * the correct position relative to the container.
 *
 * When `imageScale` is provided, the SVG clone is rasterized at
 * `width * imageScale` by `height * imageScale` pixels so that
 * high-DPI exports remain sharp. The drawing coordinates remain
 * in CSS pixels (the caller's context transform handles scaling).
 *
 * @param ctx - canvas 2D context to draw on
 *
 * @param container - canvas container for position reference
 *
 * @param overlay - SVG overlay div holding the background SVG element
 *
 * @param imageScale - rasterization multiplier for the SVG Image
 *   (defaults to 1; set to `devicePixelRatio` for high-DPI exports)
 *
 * @example
 * ```ts
 * await renderSvgOverlayToContext({ ctx, container, overlay, imageScale: 2 });
 * ```
 */
export async function renderSvgOverlayToContext({ ctx, container, overlay, imageScale, }: {
  ctx: OffscreenCanvasRenderingContext2D;
  container: HTMLDivElement;
  overlay: HTMLDivElement;
  imageScale?: number;
},): Promise<void> {
  const info = measureSvgOverlay({ container, overlay, },);
  if (info === null)
    return;

  /** Rasterization scale factor for the SVG Image */
  const scale = imageScale ?? 1;

  /** Set explicit dimensions so the Image decodes at the correct size */
  info.clone.setAttribute('width', String(info.width * scale,),);
  info.clone.setAttribute('height', String(info.height * scale,),);
  /** Re-serialized SVG markup encoded as a data URL for Image loading */
  const svgMarkup = new XMLSerializer().serializeToString(info.clone,);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup,)}`;
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  ctx.drawImage(img, info.offsetX, info.offsetY, info.width, info.height,);
}

/**
 * Renders the base composite canvas with white background, drawn
 * strokes, and SVG background on top. Strokes are drawn beneath
 * the SVG linework, matching the on-screen layer order.
 *
 * Text is intentionally excluded so that PDF export can handle
 * text separately as real, selectable PDF text content.
 *
 * @param container - canvas container for sizing
 *
 * @param overlay - SVG overlay div
 *
 * @returns offscreen canvas and its 2D context for further drawing
 *
 * @example
 * ```ts
 * const { canvas, ctx } = await renderBaseCanvas({ container, overlay });
 * ```
 */
export async function renderBaseCanvas({ container, overlay, strokes, imageScale, }: {
  container: HTMLDivElement;
  overlay: HTMLDivElement;
  strokes?: readonly import('./drawing.ts').StrokeData[];
  imageScale?: number;
},): Promise<{ canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D; }> {
  const { cw, ch, } = getContainerSize(container,);
  /** Scale factor for high-DPI rendering (defaults to 1) */
  const scale = imageScale ?? 1;

  const exportCanvas = new OffscreenCanvas(cw * scale, ch * scale,);
  const ctx = requireOffscreenContext(exportCanvas,);

  if (scale !== 1)
    ctx.scale(scale, scale,);

  //region Layer 1: white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, cw, ch,);
  //endregion Layer 1

  //region Layer 2: canvas strokes (behind SVG linework)
  renderStrokes({ ctx, cw, ch, strokes: strokes ?? getStrokes(), },);
  //endregion Layer 2

  //region Layer 3: SVG background on top
  await renderSvgOverlayToContext({ ctx, container, overlay, imageScale: scale, },);
  //endregion Layer 3

  return { canvas: exportCanvas, ctx, };
}

/**
 * Triggers a browser file download from a Blob.
 *
 * Creates a temporary object URL and anchor element to initiate
 * the download, then immediately revokes the URL.
 *
 * @param blob - file content as a Blob
 *
 * @param filename - suggested download filename
 *
 * @example
 * ```ts
 * triggerDownload({ blob: pngBlob, filename: 'doodle.png' });
 * ```
 */
export function triggerDownload({ blob, filename, }: {
  blob: Blob;
  filename: string;
},): void {
  const url = URL.createObjectURL(blob,);
  const link = document.createElement('a',);
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url,);
}
