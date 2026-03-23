/**
 * PDF export for the doodle widget.
 *
 * Renders all pages as a multi-page PDF with rasterized backgrounds
 * and strokes, but preserves text annotations as real, selectable
 * PDF text. Drawing strokes are composited beneath SVG linework,
 * matching the on-screen layer order.
 */

import { jsPDF, } from 'jspdf';

import type { ExportDeps, } from './export.ts';
import { renderPageCanvas, } from './export-pdf-page.ts';
import { snapshotAllPages, } from './pages.ts';

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
 * Exports all pages as a multi-page PDF file.
 *
 * Each page is rendered with strokes beneath SVG linework.
 * Text annotations are overlaid as real PDF text so they remain
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
  const { container, overlay, textLayer, } = deps;
  /** Container width in CSS pixels */
  const cw = container.clientWidth;
  /** Container height in CSS pixels */
  const ch = container.clientHeight;

  /** Snapshot all pages (saves current page's live state) */
  const allPages = snapshotAllPages({ overlay, textLayer, },);
  /** Save overlay HTML to restore after export */
  const savedOverlayHtml = overlay.innerHTML;

  //region PDF document setup (all dimensions in points)
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
  //endregion PDF document setup

  //region Text rendering setup
  /** Default text font size in points for inputs without data attributes */
  const rootFontSize = Number.parseFloat(
    getComputedStyle(document.documentElement,).fontSize,
  ) || DEFAULT_ROOT_FONT_SIZE_PX;
  const defaultFontSizePt = TEXT_FONT_SIZE_REM * rootFontSize * PX_TO_PT;
  //endregion Text rendering setup

  //region Render each page
  for (const [pageIndex, page,] of allPages.entries()) {
    if (pageIndex > 0)
      doc.addPage([pageW, pageH,],);

    /** Composited raster image for this page */
    // eslint-disable-next-line no-await-in-loop -- pages render sequentially; each mutates the shared overlay element
    const pageCanvas = await renderPageCanvas({
      cw, ch,
      svgBackground: page.svgBackground,
      strokes: page.strokes,
      container, overlay,
    },);

    /** PNG image data as byte array for jsPDF embedding */
    // eslint-disable-next-line no-await-in-loop -- depends on sequential page rendering above
    const blob = await pageCanvas.convertToBlob({ type: 'image/png', },);
    // eslint-disable-next-line no-await-in-loop -- depends on sequential blob above
    const buffer = await blob.arrayBuffer();
    const imageData = new Uint8Array(buffer,);
    doc.addImage(imageData, 'PNG', 0, 0, pageW, pageH,);

    //region Overlay text as real PDF text
    for (const entry of page.textEntries) {
      if (entry.value.trim() === '')
        continue;
      /** Per-entry font size in points, falling back to CSS default */
      const fontSizePt = entry.fontSize !== ''
        ? Number.parseFloat(entry.fontSize,) * PX_TO_PT
        : defaultFontSizePt;
      doc.setFontSize(fontSizePt,);
      if (entry.color !== '') {
        const rgb = hexToRgb(entry.color,);
        doc.setTextColor(rgb.r, rgb.g, rgb.b,);
      }
      else {
        doc.setTextColor(TEXT_COLOR_R, TEXT_COLOR_G, TEXT_COLOR_B,);
      }
      /** Horizontal position in points */
      const x = (Number.parseFloat(entry.insetInlineStart,) / PERCENT_DIVISOR) * pageW;
      /** Vertical position in points */
      const y = (Number.parseFloat(entry.insetBlockStart,) / PERCENT_DIVISOR) * pageH;
      doc.text(entry.value, x, y, { baseline: 'top', },);
    }
    //endregion Overlay text
  }
  //endregion Render each page

  /** Restore overlay to its original state */
  overlay.innerHTML = savedOverlayHtml;

  doc.save('doodle.pdf',);
}
