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

/** Bit shift for extracting red channel from packed 24-bit RGB */
const RED_SHIFT = 16;

/** Bit shift for extracting green channel from packed 24-bit RGB */
const GREEN_SHIFT = 8;

/** Bit mask for isolating a single 8-bit color channel */
const CHANNEL_MASK = 0xFF;

/** Hexadecimal radix for Number.parseInt */
const HEX_RADIX = 16;

//endregion Constants

/**
 * Converts a `#rrggbb` hex color string to RGB components.
 *
 * @param hex - color string in `#rrggbb` format
 *
 * @returns RGB components as 0-255 integers
 *
 * @example
 * ```ts
 * const { r, g, b } = hexToRgb('#c24e2e');
 * ```
 */
function hexToRgb(hex: string,): { r: number; g: number; b: number; } {
  /** 24-bit integer parsed from the hex digits */
  const packed = Number.parseInt(hex.slice(1,), HEX_RADIX,);
  return {
    r: (packed >> RED_SHIFT) & CHANNEL_MASK,
    g: (packed >> GREEN_SHIFT) & CHANNEL_MASK,
    b: packed & CHANNEL_MASK,
  };
}

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

  // eslint-disable-next-line new-cap -- jsPDF uses lowercase constructor by convention
  const doc = new jsPDF({
    orientation: pageW >= pageH ? 'l' : 'p',
    unit: 'pt',
    format: [pageW, pageH,],
  },);

  doc.addImage(imageData, 'PNG', 0, 0, pageW, pageH,);
  //endregion Build PDF document

  //region Overlay text as real PDF text
  /** Default text font size in points for inputs without data attributes */
  const rootFontSize = Number.parseFloat(
    getComputedStyle(document.documentElement,).fontSize,
  ) || DEFAULT_ROOT_FONT_SIZE_PX;
  const defaultFontSizePt = TEXT_FONT_SIZE_REM * rootFontSize * PX_TO_PT;

  /** All text input elements */
  const textInputs = textLayer.querySelectorAll<HTMLInputElement>('.text-input',);
  for (const input of textInputs) {
    if (input.value.trim() === '')
      continue;
    /** Per-input font size in points, falling back to CSS default */
    const fontSizePt = input.dataset.fontSize !== undefined
      ? Number.parseFloat(input.dataset.fontSize,) * PX_TO_PT
      : defaultFontSizePt;
    doc.setFontSize(fontSizePt,);
    if (input.dataset.color !== undefined) {
      const rgb = hexToRgb(input.dataset.color,);
      doc.setTextColor(rgb.r, rgb.g, rgb.b,);
    }
    else {
      doc.setTextColor(TEXT_COLOR_R, TEXT_COLOR_G, TEXT_COLOR_B,);
    }
    /** Horizontal position in points */
    const x = (Number.parseFloat(input.style.insetInlineStart,) / PERCENT_DIVISOR) * pageW;
    /** Vertical position in points */
    const y = (Number.parseFloat(input.style.insetBlockStart,) / PERCENT_DIVISOR) * pageH;
    doc.text(input.value, x, y, { baseline: 'top', },);
  }
  //endregion Overlay text

  doc.save('doodle.pdf',);
}
