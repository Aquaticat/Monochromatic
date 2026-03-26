/**
 * SVG export for the doodle widget.
 *
 * Builds a self-contained SVG document with vector paths for strokes,
 * real `<text>` elements for annotations, and the background SVG
 * embedded as a nested `<svg>`.
 */

import {
  getStrokes,
  type NormalizedPoint,
} from './drawing.ts';
import { readTextEntries, } from './export-text-config.ts';
import {
  type ExportDeps,
  getContainerSize,
  triggerDownload,
} from './export.ts';
import { MIN_STROKE_POINTS, } from './stroke-renderer.ts';
import { measureSvgOverlay, } from './svg-overlay-measure.ts';

/** SVG XML namespace */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Exports the doodle as an SVG file.
 *
 * Produces a self-contained SVG with vector `<path>` elements for
 * strokes, `<text>` elements for annotations (selectable and
 * searchable), and the background SVG embedded as a nested `<svg>`.
 *
 * @param container - canvas container for sizing
 *
 * @param overlay - SVG overlay div
 *
 * @param textLayer - div containing text input elements
 *
 * @example
 * ```ts
 * exportAsSvg({ container, overlay, drawCanvas, textLayer });
 * ```
 */
export function exportAsSvg(
  {
    container,
    overlay,
    textLayer,
  }: ExportDeps,
): void {
  const {
    cw,
    ch,
  } = getContainerSize(container,);

  const svg = document.createElementNS(
    SVG_NS,
    'svg',
  );
  svg.setAttribute(
    'xmlns',
    SVG_NS,
  );
  svg.setAttribute(
    'viewBox',
    `0 0 ${String(cw,)} ${String(ch,)}`,
  );
  svg.setAttribute(
    'width',
    String(cw,),
  );
  svg.setAttribute(
    'height',
    String(ch,),
  );

  //region White background
  const bgRect = document.createElementNS(
    SVG_NS,
    'rect',
  );
  bgRect.setAttribute(
    'width',
    String(cw,),
  );
  bgRect.setAttribute(
    'height',
    String(ch,),
  );
  bgRect.setAttribute(
    'fill',
    'white',
  );
  svg.append(bgRect,);
  //endregion White background

  //region Strokes (behind SVG overlay)
  const strokes = getStrokes();
  for (const stroke of strokes) {
    if (stroke.points.length < MIN_STROKE_POINTS)
      continue;
    const path = document.createElementNS(
      SVG_NS,
      'path',
    );
    /** SVG path data built from normalized stroke coordinates */
    const d = stroke
      .points
      .map(
        function formatPoint(
          [nx, ny,]: NormalizedPoint,
          index: number,
        ): string {
          const cmd = index === 0 ? 'M' : 'L';
          return `${cmd}${String(nx * cw,)},${String(ny * ch,)}`;
        },
      )
      .join(' ',);
    path.setAttribute(
      'd',
      d,
    );
    path.setAttribute(
      'stroke',
      stroke.color,
    );
    path.setAttribute(
      'stroke-width',
      String(stroke.width,),
    );
    path.setAttribute(
      'fill',
      'none',
    );
    path.setAttribute(
      'stroke-linecap',
      'round',
    );
    path.setAttribute(
      'stroke-linejoin',
      'round',
    );
    svg.append(path,);
  }
  //endregion Strokes

  //region Background SVG with multiply blending (on top of strokes)
  const overlayInfo = measureSvgOverlay({
    container,
    overlay,
  },);
  if (overlayInfo !== null) {
    overlayInfo.clone.setAttribute(
      'x',
      String(overlayInfo.offsetX,),
    );
    overlayInfo.clone.setAttribute(
      'y',
      String(overlayInfo.offsetY,),
    );
    overlayInfo.clone.setAttribute(
      'width',
      String(overlayInfo.width,),
    );
    overlayInfo.clone.setAttribute(
      'height',
      String(overlayInfo.height,),
    );
    overlayInfo.clone.setAttribute(
      'style',
      'mix-blend-mode:multiply',
    );
    svg.append(overlayInfo.clone,);
  }
  //endregion Background SVG

  //region Text annotations
  const textEntries = readTextEntries({ textLayer, },);
  for (const entry of textEntries) {
    const text = document.createElementNS(
      SVG_NS,
      'text',
    );
    text.setAttribute(
      'x',
      String(entry.xFraction * cw,),
    );
    text.setAttribute(
      'y',
      String(entry.yFraction * ch,),
    );
    text.setAttribute(
      'font-family',
      'system-ui, sans-serif',
    );
    text.setAttribute(
      'font-size',
      String(entry.fontSizePx,),
    );
    text.setAttribute(
      'fill',
      entry.color,
    );
    text.setAttribute(
      'dominant-baseline',
      'hanging',
    );
    text.textContent = entry.value;
    svg.append(text,);
  }
  //endregion Text annotations

  /** Serialized SVG markup for download */
  const markup = new XMLSerializer().serializeToString(svg,);
  const blob = new Blob(
    [markup,],
    { type: 'image/svg+xml;charset=utf-8', },
  );
  triggerDownload({
    blob,
    filename: 'doodle.svg',
  },);
}
