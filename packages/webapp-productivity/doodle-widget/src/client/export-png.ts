/**
 * PNG export for the doodle widget.
 *
 * Renders all layers (background, strokes, text) as a rasterized
 * PNG image and triggers a download.
 */

import { readTextEntries, } from './export-text-config.ts';
import {
  type ExportDeps,
  getContainerSize,
  renderBaseCanvas,
  triggerDownload,
} from './export.ts';

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
  const {
    container,
    textLayer,
  } = deps;
  const {
    cw,
    ch,
  } = getContainerSize(container,);

  const {
    canvas,
    ctx,
  } = await renderBaseCanvas(deps,);

  //region Layer 4: text annotations
  ctx.textBaseline = 'top';

  const textEntries = readTextEntries({ textLayer, },);
  for (const entry of textEntries) {
    ctx.font = `${String(entry.fontSizePx,)}px system-ui, sans-serif`;
    ctx.fillStyle = entry.color;
    ctx.fillText(
      entry.value,
      entry.xFraction * cw,
      entry.yFraction * ch,
    );
  }
  //endregion Layer 4

  const blob = await canvas.convertToBlob({ type: 'image/png', },);
  triggerDownload({
    blob,
    filename: 'doodle.png',
  },);
}
