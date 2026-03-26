/**
 * Background management for the doodle widget.
 *
 * Handles SVG backgrounds by making large white fills transparent
 * so canvas strokes show through beneath the SVG linework, while
 * preserving small white content elements (eyes, dots, speech
 * bubbles, character highlights).
 */

import {
  clearWhiteFill,
  hasWhiteFill,
} from '../white-fill.ts';

/**
 * Minimum fraction of SVG viewport area an element must cover
 * to be considered a background fill. Elements below this
 * threshold keep their white fill intact.
 *
 * Backgrounds (panel fills, page fills) typically span > 10% of the
 * SVG area. Content elements (eyes, braille dots, clothing details)
 * are much smaller.
 */
const BACKGROUND_AREA_FRACTION = 0.1;

/**
 * Removes white fills from large background elements in the overlay.
 *
 * Walks all descendant elements of the SVG already rendered in
 * `overlay`, identifies white-filled elements whose bounding box
 * exceeds {@link BACKGROUND_AREA_FRACTION} of the SVG viewport
 * area, and sets their fill to `none`. Small content elements
 * (character eyes, braille dots, speech bubbles) are left untouched.
 *
 * Requires the SVG to be rendered in the DOM so `getBoundingClientRect`
 * returns accurate dimensions accounting for all CSS transforms.
 *
 * @param overlay - container element with SVG already set as innerHTML
 */
function removeWhiteBackgrounds(overlay: HTMLElement,): void {
  const svg = overlay.querySelector('svg',);
  if (!svg)
    return;

  /** Rendered SVG dimensions in CSS pixels, accounting for transforms */
  const svgRect = svg.getBoundingClientRect();
  const svgArea = svgRect.width * svgRect.height;

  if (svgArea === 0)
    return;

  /** Area threshold below which white fills are preserved */
  const threshold = svgArea * BACKGROUND_AREA_FRACTION;

  const allElements = svg.querySelectorAll('*',);
  for (const element of allElements) {
    if (!hasWhiteFill(element,))
      continue;

    /** Element bounding box in viewport pixels, with all transforms applied */
    const elemRect = element.getBoundingClientRect();
    const elemArea = elemRect.width * elemRect.height;

    if (elemArea >= threshold)
      clearWhiteFill(element,);
  }
}

/**
 * Sets an SVG background in the overlay element, stripping only
 * large white background fills.
 *
 * Inserts raw SVG markup into the overlay, then uses live DOM
 * measurement to identify and remove white fills that cover a
 * significant portion of the SVG area (panel backgrounds, page
 * fills). Small white content elements are preserved.
 *
 * @param svgMarkup - raw SVG markup to display
 *
 * @param overlay - overlay element to render the SVG into
 */
export function setSvgBackground({
  svgMarkup,
  overlay,
}: {
  svgMarkup: string;
  overlay: HTMLElement;
},): void {
  /** Insert raw SVG so the browser lays it out for measurement */
  overlay.innerHTML = svgMarkup;

  /** Strip only large white backgrounds, preserving content fills */
  removeWhiteBackgrounds(overlay,);
}
