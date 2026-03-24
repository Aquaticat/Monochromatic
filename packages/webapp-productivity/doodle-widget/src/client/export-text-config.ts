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
 * Raw text entry fields needed to build an {@link ExportTextEntry}.
 *
 * Abstracts over DOM inputs and serialized data so the resolution
 * logic runs once in {@link resolveExportEntry}.
 */
type RawEntryFields = {
  /** Text content */
  readonly value: string;
  /** CSS percentage string for horizontal position */
  readonly insetInlineStart: string;
  /** CSS percentage string for vertical position */
  readonly insetBlockStart: string;
  /** Font size in pixels as numeric string, or empty/undefined when unset */
  readonly fontSize: string | undefined;
  /** CSS color string, or empty/undefined when unset */
  readonly color: string | undefined;
};

/**
 * Resolves raw text entry fields into an export-ready entry.
 *
 * Applies font size and color fallbacks, parses percentage positions
 * to fractions, and returns a normalized {@link ExportTextEntry}.
 *
 * @param raw - raw entry fields from DOM or serialized data
 *
 * @param defaultFontSizePx - fallback font size in pixels
 *
 * @returns resolved export entry
 */
function resolveExportEntry(
  { raw, defaultFontSizePx, }: { raw: RawEntryFields; defaultFontSizePx: number; },
): ExportTextEntry {
  /** Per-entry font size, falling back to CSS default */
  const fontSizePx = raw.fontSize !== undefined && raw.fontSize !== ''
    ? Number.parseFloat(raw.fontSize,)
    : defaultFontSizePx;
  /** Per-entry color, falling back to CSS default */
  const color = raw.color !== undefined && raw.color !== '' ? raw.color : TEXT_COLOR;

  return {
    value: raw.value,
    xFraction: Number.parseFloat(raw.insetInlineStart,) / PERCENT_DIVISOR,
    yFraction: Number.parseFloat(raw.insetBlockStart,) / PERCENT_DIVISOR,
    fontSizePx,
    color,
  };
}

/**
 * Filters and resolves raw entry fields into export-ready entries.
 *
 * Computes the default font size once, skips empty entries, and
 * delegates to {@link resolveExportEntry} for each valid entry.
 *
 * @param raws - iterable of raw entry fields
 *
 * @returns array of parsed text entries ready for export
 */
function resolveExportEntries(raws: Iterable<RawEntryFields>,): ExportTextEntry[] {
  /** Default text font size in pixels */
  const defaultFontSizePx = TEXT_FONT_SIZE_REM * getRootFontSizePx();
  const entries: ExportTextEntry[] = [];

  for (const raw of raws) {
    if (raw.value.trim() === '')
      continue;
    entries.push(resolveExportEntry({ raw, defaultFontSizePx, },),);
  }

  return entries;
}

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
},): ExportTextEntry[] {
  const inputs = textLayer.querySelectorAll<HTMLInputElement>('.text-input',);

  return resolveExportEntries(
    Array.from(inputs, function toRaw(input,): RawEntryFields {
      return {
        value: input.value,
        insetInlineStart: input.style.insetInlineStart,
        insetBlockStart: input.style.insetBlockStart,
        fontSize: input.dataset.fontSize,
        color: input.dataset.color,
      };
    },),
  );
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
  return resolveExportEntries(
    serialized.map(function toRaw(entry,): RawEntryFields {
      return {
        value: entry.value,
        insetInlineStart: entry.insetInlineStart,
        insetBlockStart: entry.insetBlockStart,
        fontSize: entry.fontSize || undefined,
        color: entry.color || undefined,
      };
    },),
  );
}

//endregion Text entry reading
