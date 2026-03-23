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
import {
  triggerDownload,
  type ExportDeps,
} from './export.ts';

//region Constants

/** SVG XML namespace */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Font size for text in rem, matching `.text-input` CSS */
const TEXT_FONT_SIZE_REM = 1.25;

/** Fallback root font size in pixels */
const DEFAULT_ROOT_FONT_SIZE_PX = 16;

/** Divisor for percentage-to-fraction conversion */
const PERCENT_DIVISOR = 100;

/** Text fill color matching `.text-input` CSS */
const TEXT_COLOR = 'oklch(0.3 0 0)';

/** Minimum number of points in a stroke to be exportable */
const MIN_STROKE_POINTS = 2;

//endregion Constants

/**
 * Exports the doodle as an SVG file.
 *
 * Produces a self-contained SVG with vector `<path>` elements for
 * strokes, `<text>` elements for annotations (selectable and
 * searchable), and the background SVG embedded as a nested `<svg>`.
 *
 * @param deps - shared export dependencies
 *
 * @example
 * ```ts
 * await exportAsSvg({ container, overlay, drawCanvas, textLayer });
 * ```
 */
export async function exportAsSvg(
  { container, overlay, textLayer, }: ExportDeps,
): Promise<void> {
  /** Container width in CSS pixels */
  const cw = container.clientWidth;
  /** Container height in CSS pixels */
  const ch = container.clientHeight;

  const svg = document.createElementNS(SVG_NS, 'svg',);
  svg.setAttribute('xmlns', SVG_NS,);
  svg.setAttribute('viewBox', `0 0 ${String(cw,)} ${String(ch,)}`,);
  svg.setAttribute('width', String(cw,),);
  svg.setAttribute('height', String(ch,),);

  //region White background
  const bgRect = document.createElementNS(SVG_NS, 'rect',);
  bgRect.setAttribute('width', String(cw,),);
  bgRect.setAttribute('height', String(ch,),);
  bgRect.setAttribute('fill', 'white',);
  svg.append(bgRect,);
  //endregion White background

  //region Background SVG
  /** Background SVG element from the overlay, if present */
  const svgElement = overlay.querySelector<SVGSVGElement>(':scope > svg',);
  if (svgElement !== null) {
    /** Container position for offset calculation */
    const containerRect = container.getBoundingClientRect();
    /** Rendered SVG position and dimensions */
    const svgRect = svgElement.getBoundingClientRect();
    const clone = svgElement.cloneNode(true,) as SVGSVGElement;
    clone.setAttribute('x', String(svgRect.left - containerRect.left,),);
    clone.setAttribute('y', String(svgRect.top - containerRect.top,),);
    clone.setAttribute('width', String(svgRect.width,),);
    clone.setAttribute('height', String(svgRect.height,),);
    svg.append(clone,);
  }
  //endregion Background SVG

  //region Strokes
  const strokes = getStrokes();
  for (const stroke of strokes) {
    if (stroke.points.length < MIN_STROKE_POINTS)
      continue;
    const path = document.createElementNS(SVG_NS, 'path',);
    /** SVG path data built from normalized stroke coordinates */
    const d = stroke.points.map(
      function formatPoint([nx, ny,]: NormalizedPoint, index: number,): string {
        const cmd = index === 0 ? 'M' : 'L';
        return `${cmd}${String(nx * cw,)},${String(ny * ch,)}`;
      },
    ).join(' ',);
    path.setAttribute('d', d,);
    path.setAttribute('stroke', stroke.color,);
    path.setAttribute('stroke-width', String(stroke.width,),);
    path.setAttribute('fill', 'none',);
    path.setAttribute('stroke-linecap', 'round',);
    path.setAttribute('stroke-linejoin', 'round',);
    svg.append(path,);
  }
  //endregion Strokes

  //region Text annotations
  /** Default text font size in pixels for inputs without data attributes */
  const rootFontSize = parseFloat(
    getComputedStyle(document.documentElement,).fontSize,
  ) || DEFAULT_ROOT_FONT_SIZE_PX;
  const defaultFontSizePx = TEXT_FONT_SIZE_REM * rootFontSize;

  /** All text input elements */
  const textInputs = textLayer.querySelectorAll<HTMLInputElement>('.text-input',);
  for (const input of textInputs) {
    if (input.value.trim() === '')
      continue;
    const text = document.createElementNS(SVG_NS, 'text',);
    /** Horizontal position in pixels */
    const x = (parseFloat(input.style.insetInlineStart,) / PERCENT_DIVISOR) * cw;
    /** Vertical position in pixels */
    const y = (parseFloat(input.style.insetBlockStart,) / PERCENT_DIVISOR) * ch;
    /** Per-input font size, falling back to CSS default */
    const fontSizePx = input.dataset.fontSize !== undefined
      ? parseFloat(input.dataset.fontSize,)
      : defaultFontSizePx;
    /** Per-input color, falling back to CSS default */
    const color = input.dataset.color ?? TEXT_COLOR;
    text.setAttribute('x', String(x,),);
    text.setAttribute('y', String(y,),);
    text.setAttribute('font-family', 'system-ui, sans-serif',);
    text.setAttribute('font-size', String(fontSizePx,),);
    text.setAttribute('fill', color,);
    text.setAttribute('dominant-baseline', 'hanging',);
    text.textContent = input.value;
    svg.append(text,);
  }
  //endregion Text annotations

  /** Serialized SVG markup for download */
  const markup = new XMLSerializer().serializeToString(svg,);
  const blob = new Blob([markup,], { type: 'image/svg+xml;charset=utf-8', },);
  triggerDownload({ blob, filename: 'doodle.svg', },);
}
