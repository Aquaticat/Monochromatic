/**
 * PDF export for the doodle widget.
 *
 * Renders the doodle as a PDF with rasterized background and strokes,
 * but preserves text annotations as real, selectable PDF text.
 */

import { jsPDF, } from 'jspdf';

import {
  renderBaseCanvas,
  type ExportDeps,
} from './export.ts';

//region Constants

/** Font size for text in rem, matching `.text-input` CSS */
const TEXT_FONT_SIZE_REM = 1.25;

/** Fallback root font size in pixels */
const DEFAULT_ROOT_FONT_SIZE_PX = 16;

/** Divisor for percentage-to-fraction conversion */
const PERCENT_DIVISOR = 100;

/** Approximate sRGB red channel for oklch(0.3 0 0) */
const TEXT_COLOR_R = 46;

/** Approximate sRGB green channel for oklch(0.3 0 0) */
const TEXT_COLOR_G = 46;

/** Approximate sRGB blue channel for oklch(0.3 0 0) */
const TEXT_COLOR_B = 46;

/** Conversion factor from CSS pixels to PDF points (72/96) */
const PX_TO_PT = 0.75;

//endregion Constants

/**
 * Exports the doodle as a PDF file.
 *
 * Uses a rasterized composite image for the background and strokes,
 * then overlays text annotations as real PDF text so they remain
 * selectable and searchable in the output.
 *
 * @param deps - shared export dependencies
 *
 * @example
 * ```ts
 * await exportAsPdf({ container, overlay, drawCanvas, textLayer });
 * ```
 */
export async function exportAsPdf(deps: ExportDeps,): Promise<void> {
  const { container, textLayer, } = deps;
  /** Container width in CSS pixels */
  const cw = container.clientWidth;
  /** Container height in CSS pixels */
  const ch = container.clientHeight;

  //region Rasterize base layers
  const { canvas, } = await renderBaseCanvas(deps,);
  const blob = await canvas.convertToBlob({ type: 'image/png', },);
  /** PNG image data as byte array for jsPDF embedding */
  const buffer = await blob.arrayBuffer();
  const imageData = new Uint8Array(buffer,);
  //endregion Rasterize base layers

  //region Build PDF document (all dimensions in points)
  /** Page width in PDF points */
  const pageW = cw * PX_TO_PT;
  /** Page height in PDF points */
  const pageH = ch * PX_TO_PT;

  const doc = new jsPDF({
    orientation: pageW >= pageH ? 'l' : 'p',
    unit: 'pt',
    format: [pageW, pageH,],
  },);

  doc.addImage(imageData, 'PNG', 0, 0, pageW, pageH,);
  //endregion Build PDF document

  //region Overlay text as real PDF text
  /** Computed root font size for rem-to-px conversion */
  const rootFontSize = parseFloat(
    getComputedStyle(document.documentElement,).fontSize,
  ) || DEFAULT_ROOT_FONT_SIZE_PX;
  /** Text font size in points */
  const fontSizePt = TEXT_FONT_SIZE_REM * rootFontSize * PX_TO_PT;
  doc.setFontSize(fontSizePt,);
  doc.setTextColor(TEXT_COLOR_R, TEXT_COLOR_G, TEXT_COLOR_B,);

  /** All text input elements */
  const textInputs = textLayer.querySelectorAll<HTMLInputElement>('.text-input',);
  for (const input of textInputs) {
    if (input.value.trim() === '')
      continue;
    /** Horizontal position in points */
    const x = (parseFloat(input.style.insetInlineStart,) / PERCENT_DIVISOR) * pageW;
    /** Vertical position in points */
    const y = (parseFloat(input.style.insetBlockStart,) / PERCENT_DIVISOR) * pageH;
    doc.text(input.value, x, y, { baseline: 'top', },);
  }
  //endregion Overlay text

  doc.save('doodle.pdf',);
}
