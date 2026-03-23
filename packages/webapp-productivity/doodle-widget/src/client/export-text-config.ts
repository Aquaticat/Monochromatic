/**
 * Shared text export configuration for the doodle widget.
 *
 * Centralizes constants, color values, and DOM reading logic
 * used by SVG, PDF, and PNG exporters.
 */

//region Constants

/** Font size for text inputs in rem, matching `.text-input` CSS */
export const TEXT_FONT_SIZE_REM = 1.25;

/** Fallback root font size in pixels when computed value is unavailable */
export const DEFAULT_ROOT_FONT_SIZE_PX = 16;

/** Divisor for converting percentage positions to the 0..1 range */
export const PERCENT_DIVISOR = 100;

/** Text fill color as oklch string, matching `.text-input` CSS */
export const TEXT_COLOR = 'oklch(0.3 0 0)';

/** Approximate sRGB components for oklch(0.3 0 0), used by jsPDF */
export const TEXT_COLOR_RGB = { r: 46, g: 46, b: 46, } as const;

//endregion Constants

/**
 * Returns the computed root font size in pixels.
 *
 * Falls back to {@link DEFAULT_ROOT_FONT_SIZE_PX} when the computed
 * style is unavailable or zero.
 *
 * @returns root font size in pixels
 *
 * @example
 * ```ts
 * const rootPx = getRootFontSizePx();
 * const textSizePx = TEXT_FONT_SIZE_REM * rootPx;
 * ```
 */
export function getRootFontSizePx(): number {
  return Number.parseFloat(
    getComputedStyle(document.documentElement,).fontSize,
  ) || DEFAULT_ROOT_FONT_SIZE_PX;
}

//region Text entry reading

/**
 * Parsed text entry data ready for export rendering.
 *
 * @example
 * ```ts
 * const entries = readTextEntries({ textLayer });
 * for (const e of entries) {
 *   ctx.fillText(e.value, e.xFraction * cw, e.yFraction * ch);
 * }
 * ```
 */
export type ExportTextEntry = {
  /** Non-empty text content */
  readonly value: string;
  /** Horizontal position as 0..1 fraction */
  readonly xFraction: number;
  /** Vertical position as 0..1 fraction */
  readonly yFraction: number;
  /** Font size in pixels */
  readonly fontSizePx: number;
  /** CSS color string */
  readonly color: string;
};

/**
 * Reads finalized text entries from the text layer DOM.
 *
 * Parses percentage positions to fractions, resolves per-input
 * font size and color (falling back to defaults), and filters
 * out empty entries.
 *
 * @param textLayer - text layer div containing `.text-input` elements
 *
 * @returns array of parsed text entries ready for export
 *
 * @example
 * ```ts
 * const entries = readTextEntries({ textLayer });
 * ```
 */
export function readTextEntries({ textLayer, }: {
  textLayer: HTMLDivElement;
}): ExportTextEntry[] {
  /** Default text font size in pixels */
  const defaultFontSizePx = TEXT_FONT_SIZE_REM * getRootFontSizePx();

  const inputs = textLayer.querySelectorAll<HTMLInputElement>('.text-input',);
  const entries: ExportTextEntry[] = [];

  for (const input of inputs) {
    if (input.value.trim() === '')
      continue;

    /** Per-input font size, falling back to CSS default */
    const fontSizePx = input.dataset.fontSize !== undefined
      ? Number.parseFloat(input.dataset.fontSize,)
      : defaultFontSizePx;
    /** Per-input color, falling back to CSS default */
    const color = input.dataset.color ?? TEXT_COLOR;

    entries.push({
      value: input.value,
      xFraction: Number.parseFloat(input.style.insetInlineStart,) / PERCENT_DIVISOR,
      yFraction: Number.parseFloat(input.style.insetBlockStart,) / PERCENT_DIVISOR,
      fontSizePx,
      color,
    },);
  }

  return entries;
}

/**
 * Converts serialized text entry data to export-ready entries.
 *
 * Used by multi-page PDF export where text entries are read from
 * saved page state rather than the live DOM.
 *
 * @param serialized - serialized text entry data from page state
 *
 * @returns array of parsed text entries ready for export
 *
 * @example
 * ```ts
 * const entries = textEntriesToExport(page.textEntries);
 * ```
 */
export function textEntriesToExport(
  serialized: readonly import('./text-page.ts').TextEntryData[],
): ExportTextEntry[] {
  /** Default text font size in pixels */
  const defaultFontSizePx = TEXT_FONT_SIZE_REM * getRootFontSizePx();
  const entries: ExportTextEntry[] = [];

  for (const entry of serialized) {
    if (entry.value.trim() === '')
      continue;

    /** Per-entry font size, falling back to CSS default */
    const fontSizePx = entry.fontSize !== ''
      ? Number.parseFloat(entry.fontSize,)
      : defaultFontSizePx;
    /** Per-entry color, falling back to CSS default */
    const color = entry.color !== '' ? entry.color : TEXT_COLOR;

    entries.push({
      value: entry.value,
      xFraction: Number.parseFloat(entry.insetInlineStart,) / PERCENT_DIVISOR,
      yFraction: Number.parseFloat(entry.insetBlockStart,) / PERCENT_DIVISOR,
      fontSizePx,
      color,
    },);
  }

  return entries;
}

//endregion Text entry reading
