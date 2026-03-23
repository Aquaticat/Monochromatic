/**
 * Background management for the doodle widget.
 *
 * Handles SVG backgrounds by making white fills transparent
 * so canvas strokes show through beneath the SVG linework.
 */

/**
 * Regex replacing white fill declarations with transparent in SVG markup.
 *
 * Matches `fill:#fff` and `fill:#ffffff` inside inline `style` attributes
 * (Inkscape convention) as well as `fill` attributes. Replacing with
 * `fill:none` makes all white-filled shapes (panel backgrounds, speech
 * bubbles, etc.) transparent while preserving non-white content.
 */
const WHITE_FILL_RE = /fill:#fff(?:fff)?/gu;

/** White fill attribute values to detect on elements */
const WHITE_FILL_ATTRS: ReadonlySet<string> = new Set([
  '#fff', '#ffffff', 'white', 'rgb(255,255,255)',
],);

/**
 * Makes white fills transparent in an SVG string.
 *
 * Handles both inline `style` attribute fills (`fill:#ffffff`) via regex
 * and standalone `fill` attributes via DOM traversal. This covers
 * Inkscape-style SVGs (inline styles) and hand-authored SVGs
 * (fill attributes).
 *
 * @param svgMarkup - raw SVG markup string
 *
 * @returns SVG markup with white fills replaced by transparent
 *
 * @example
 * ```ts
 * const cleaned = removeWhiteFills('<svg><rect style="fill:#ffffff"/></svg>');
 * ```
 */
export function removeWhiteFills(svgMarkup: string,): string {
  /** Replace style-based white fills */
  let processed = svgMarkup.replaceAll(WHITE_FILL_RE, 'fill:none',);

  /** Also handle fill attributes on elements */
  const parser = new DOMParser();
  const doc = parser.parseFromString(processed, 'image/svg+xml',);
  const allElements = doc.querySelectorAll('[fill]',);
  for (const element of allElements) {
    const fill = (element.getAttribute('fill',) ?? '').toLowerCase().replaceAll(/\s/gu, '',);
    if (WHITE_FILL_ATTRS.has(fill,)) {
      element.setAttribute('fill', 'none',);
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement,);
}

/**
 * Sets an SVG background in the overlay element.
 *
 * Removes the white background rectangle from the SVG and displays
 * it in the overlay element.
 *
 * @param svgMarkup - raw SVG markup to display
 *
 * @param overlay - SVG overlay element
 */
export function setSvgBackground({ svgMarkup, overlay, }: {
  svgMarkup: string;
  overlay: HTMLElement;
},): void {
  const processed = removeWhiteFills(svgMarkup,);
  overlay.innerHTML = processed;
}
