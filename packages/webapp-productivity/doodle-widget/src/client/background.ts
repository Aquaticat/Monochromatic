/**
 * Background management for the doodle widget.
 *
 * Sets user-uploaded SVG backgrounds into the overlay element.
 * The overlay uses `mix-blend-mode: multiply` so white fills
 * become transparent (user strokes show through) while dark
 * outlines remain opaque on top.
 */

/**
 * Sets an SVG background in the overlay element.
 *
 * The overlay's `mix-blend-mode: multiply` CSS handles
 * transparency: white SVG fills become transparent (revealing
 * user strokes beneath) while black outlines stay opaque.
 *
 * @param svgMarkup - raw SVG markup to display
 *
 * @param overlay - SVG overlay element
 */
export function setSvgBackground({
  svgMarkup,
  overlay,
}: {
  svgMarkup: string;
  overlay: HTMLElement;
},): void {
  overlay.innerHTML = svgMarkup;
}
