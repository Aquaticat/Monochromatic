/**
 * Background management for the doodle widget.
 *
 * Handles SVG backgrounds with white background rectangle removal
 * so canvas strokes show through beneath the SVG paths.
 */

/** White fill values to detect and remove from SVG backgrounds */
const WHITE_FILLS: ReadonlySet<string> = new Set(['#fff', '#ffffff', 'white',
  'rgb(255,255,255)',],);

/**
 * Removes the white background rectangle from an SVG string.
 *
 * Parses the SVG, finds direct child `<rect>` elements with white fills,
 * removes the first match, and re-serializes the SVG.
 *
 * @param svgMarkup - raw SVG markup string
 *
 * @returns SVG markup with white background rectangle removed
 *
 * @example
 * ```ts
 * const cleaned = removeSvgWhiteBackground('<svg><rect fill="#fff"/><path .../></svg>');
 * ```
 */
export function removeSvgWhiteBackground(svgMarkup: string,): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml',);
  const svg = doc.documentElement;
  const rects = svg.querySelectorAll<SVGRectElement>(':scope > rect',);
  for (const rect of rects) {
    const fill = (rect.getAttribute('fill',) ?? '').toLowerCase().replaceAll(/\s/gu, '',);
    if (WHITE_FILLS.has(fill,)) {
      rect.remove();
      break;
    }
  }
  return new XMLSerializer().serializeToString(svg,);
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
  const processed = removeSvgWhiteBackground(svgMarkup,);
  overlay.innerHTML = processed;
}
