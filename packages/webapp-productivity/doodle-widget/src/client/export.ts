/**
 * Export facade and shared utilities for the doodle widget.
 *
 * Provides shared types, canvas compositing for raster-based exports
 * (PNG, PDF), and a common download trigger. Format-specific export
 * functions live in dedicated modules.
 *
 * Exceeds 100 lines: shared compositing, download utility, and type
 * definitions are tightly coupled export infrastructure that cannot
 * be meaningfully split further.
 */

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
 * Renders the base composite canvas with white background, SVG
 * background, and drawn strokes. Text is intentionally excluded
 * so that PDF export can handle text separately as real,
 * selectable PDF text content.
 *
 * @param container - canvas container for sizing
 *
 * @param overlay - SVG overlay div
 *
 * @param drawCanvas - canvas with rendered strokes
 *
 * @returns offscreen canvas and its 2D context for further drawing
 *
 * @example
 * ```ts
 * const { canvas, ctx } = await renderBaseCanvas({ container, overlay, drawCanvas });
 * ```
 */
export async function renderBaseCanvas({ container, overlay, drawCanvas, }: {
  container: HTMLDivElement;
  overlay: HTMLDivElement;
  drawCanvas: HTMLCanvasElement;
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

  //region Layer 2: SVG background
  /** SVG element from the overlay, if present */
  const svgElement = overlay.querySelector<SVGSVGElement>(':scope > svg',);
  if (svgElement !== null) {
    /** Container position for offset calculation */
    const containerRect = container.getBoundingClientRect();
    /** Rendered SVG position and dimensions */
    const svgRect = svgElement.getBoundingClientRect();
    /** Horizontal offset of the SVG relative to the container */
    const offsetX = svgRect.left - containerRect.left;
    /** Vertical offset of the SVG relative to the container */
    const offsetY = svgRect.top - containerRect.top;

    /** Clone with explicit dimensions so the Image decodes at the correct size */
    const clone = svgElement.cloneNode(true,) as SVGSVGElement;
    clone.setAttribute('width', String(svgRect.width,),);
    clone.setAttribute('height', String(svgRect.height,),);
    /** Re-serialized SVG markup encoded as a data URL for Image loading */
    const svgMarkup = new XMLSerializer().serializeToString(clone,);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup,)}`;
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    ctx.drawImage(img, offsetX, offsetY, svgRect.width, svgRect.height,);
  }
  //endregion Layer 2

  //region Layer 3: canvas strokes
  ctx.drawImage(drawCanvas, 0, 0,);
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
