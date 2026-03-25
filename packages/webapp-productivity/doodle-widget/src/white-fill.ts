/**
 * Shared white fill detection for SVG processing.
 *
 * Used by both the build script (Node, string-only replacement) and the
 * client-side background module (browser, DOM-aware replacement).
 */

/**
 * Regex replacing white fill declarations with transparent in SVG markup.
 *
 * Matches `fill:#fff` and `fill:#ffffff` inside inline `style` attributes
 * (Inkscape convention) as well as `fill` attributes. Replacing with
 * `fill:none` makes all white-filled shapes (panel backgrounds, speech
 * bubbles, etc.) transparent while preserving non-white content.
 */
export const WHITE_FILL_RE = /fill:#fff(?:fff)?/gu;

/**
 * Replaces style-based white fill declarations with `fill:none`.
 *
 * Handles Inkscape-style inline `style="fill:#ffffff"` attributes via
 * regex. For full DOM-aware replacement including `fill` element
 * attributes, use `removeWhiteFills` in the client background module.
 *
 * @param svgMarkup - raw SVG markup string
 *
 * @returns SVG markup with inline white fills replaced by `fill:none`
 *
 * @example
 * ```ts
 * const cleaned = replaceWhiteFillStyles('<svg style="fill:#fff">...</svg>');
 * ```
 */
export function replaceWhiteFillStyles(svgMarkup: string,): string {
  return svgMarkup.replaceAll(
    WHITE_FILL_RE,
    'fill:none',
  );
}
