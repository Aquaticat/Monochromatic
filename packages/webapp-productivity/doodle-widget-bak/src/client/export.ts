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

import {
  getStrokes,
  type StrokeData,
} from './drawing.ts';

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
 * Renders stroke data onto a 2D canvas context.
 *
 * Each stroke is drawn using its captured color and width,
 * with normalized coordinates denormalized to the given dimensions.
 *
 * @param ctx - canvas 2D context to draw on
 *
 * @param cw - canvas width in CSS pixels for coordinate denormalization
 *
 * @param ch - canvas height in CSS pixels for coordinate denormalization
 *
 * @param strokes - stroke data with normalized [0..1] coordinates
 *
 * @example
 * ```ts
 * renderStrokesToContext({ ctx, cw: 800, ch: 600, strokes: pageStrokes });
 * ```
 */
export function renderStrokesToContext({ ctx, cw, ch, strokes, }: {
  ctx: OffscreenCanvasRenderingContext2D;
  cw: number;
  ch: number;
  strokes: readonly StrokeData[];
},): void {
  for (const stroke of strokes) {
    if (stroke.points.length < 2)
      continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const [index, point,] of stroke.points.entries()) {
      if (index === 0)
        ctx.moveTo(point[0] * cw, point[1] * ch,);
      else
        ctx.lineTo(point[0] * cw, point[1] * ch,);
    }
    ctx.stroke();
  }
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
export async function renderSvgOverlayToContext(
  { ctx, container, overlay, imageScale, }: {
    ctx: OffscreenCanvasRenderingContext2D;
    container: HTMLDivElement;
    overlay: HTMLDivElement;
    imageScale?: number;
  },
): Promise<void> {
  /** SVG element from the overlay, if present */
  const svgElement = overlay.querySelector<SVGSVGElement>(':scope > svg',);
  if (svgElement === null)
    return;
  /** Container position for offset calculation */
  const containerRect = container.getBoundingClientRect();
  /** Rendered SVG position and dimensions */
  const svgRect = svgElement.getBoundingClientRect();
  /** Horizontal offset of the SVG relative to the container */
  const offsetX = svgRect.left - containerRect.left;
  /** Vertical offset of the SVG relative to the container */
  const offsetY = svgRect.top - containerRect.top;

  /** Rasterization scale factor for the SVG Image */
  const scale = imageScale ?? 1;

  /** Clone with explicit dimensions so the Image decodes at the correct size */
  const cloneNode = svgElement.cloneNode(true,);
  if (!(cloneNode instanceof SVGSVGElement))
    throw new Error('SVG clone is not an SVGSVGElement',);
  const clone = cloneNode;
  clone.setAttribute('width', String(svgRect.width * scale,),);
  clone.setAttribute('height', String(svgRect.height * scale,),);
  /** Re-serialized SVG markup encoded as a data URL for Image loading */
  const svgMarkup = new XMLSerializer().serializeToString(clone,);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup,)}`;
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  ctx.drawImage(img, offsetX, offsetY, svgRect.width, svgRect.height,);
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
export async function renderBaseCanvas({ container, overlay, }: {
  container: HTMLDivElement;
  overlay: HTMLDivElement;
},): Promise<{ canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D; }> {
  /** Container width in CSS pixels */
  const cw = container.clientWidth;
  /** Container height in CSS pixels */
  const ch = container.clientHeight;

  const exportCanvas = new OffscreenCanvas(cw, ch,);
  /** 2D context for the offscreen export canvas */
  const maybeCtx = exportCanvas.getContext('2d',);
  if (maybeCtx === null)
    throw new Error('Export canvas 2D context unavailable',);
  const ctx = maybeCtx;

  //region Layer 1: white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, cw, ch,);
  //endregion Layer 1

  //region Layer 2: canvas strokes (behind SVG linework)
  renderStrokesToContext({ ctx, cw, ch, strokes: getStrokes(), },);
  //endregion Layer 2

  //region Layer 3: SVG background on top
  await renderSvgOverlayToContext({ ctx, container, overlay, },);
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
