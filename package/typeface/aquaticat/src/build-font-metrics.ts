/**
 * Font metrics constants and glyph mapping for the Aquaticat typeface.
 *
 * @example
 * ```ts
 * import { UNITS_PER_EM, CELL_UNICODE, fontY } from "./build-font-metrics.ts";
 * ```
 */

//region Font metrics and glyph mapping

/**
 * SVG Y coordinate that corresponds to the font baseline (y = 0 in font coords).
 */
export const BASELINE_Y = 750;

/**
 * Font units per em square.
 */
export const UNITS_PER_EM = 1_000;

/**
 * Distance from baseline to top of tallest glyph, in font units.
 */
export const ASCENDER = 750;

/**
 * Distance from baseline to bottom of deepest descender, in font units.
 */
export const DESCENDER = -250;

/**
 * Horizontal padding added on each side of a glyph for proportional spacing.
 */
export const SIDE_BEARING = 40;

/**
 * Advance width for the space character (roughly half a typical glyph width).
 */
export const SPACE_ADVANCE = 300;

/**
 * Maps cell index in the strip to Unicode code point. Cells 0-16 = A-Q, 17-19 = X-Z.
 */
export const CELL_UNICODE: Record<number, number> = {
  0: 65,
  1: 66,
  2: 67,
  3: 68,
  4: 69,
  5: 70,
  6: 71,
  7: 72,
  8: 73,
  9: 74,
  10: 75,
  11: 76,
  12: 77,
  13: 78,
  14: 79,
  15: 80,
  16: 81,
  17: 88,
  18: 89,
  19: 90,
};

//endregion Font metrics and glyph mapping

//region Coordinate helpers

/**
 * Converts SVG Y to font Y (flip around baseline).
 *
 * @param svgY - Y coordinate in SVG space
 *
 * @returns Y coordinate in font space
 *
 * @example
 * ```ts
 * fontY(750); // 0 (baseline)
 * fontY(0);   // 750 (top of em square)
 * ```
 */
export function fontY(svgY: number,): number {
  return BASELINE_Y - svgY;
}

//endregion Coordinate helpers
