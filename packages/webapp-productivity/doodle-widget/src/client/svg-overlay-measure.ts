/**
 * SVG overlay measurement for the doodle widget.
 *
 * Extracts the SVG element from the overlay, clones it, and computes
 * its position relative to the container. Used by both SVG export
 * (vector embedding) and raster export (canvas drawing).
 */

/**
 * Measured and cloned SVG overlay data.
 *
 * @example
 * ```ts
 * const info = measureSvgOverlay({ container, overlay });
 * if (info !== null) {
 *   ctx.drawImage(img, info.offsetX, info.offsetY, info.width, info.height);
 * }
 * ```
 */
export type SvgOverlayInfo = {
  /** Deep clone of the SVG element */
  readonly clone: SVGSVGElement;
  /** Horizontal offset from the container's left edge */
  readonly offsetX: number;
  /** Vertical offset from the container's top edge */
  readonly offsetY: number;
  /** Rendered width of the SVG in CSS pixels */
  readonly width: number;
  /** Rendered height of the SVG in CSS pixels */
  readonly height: number;
};

/**
 * Measures the SVG overlay element's position and creates a clone.
 *
 * @param container - canvas container for position reference
 *
 * @param overlay - SVG overlay div holding the background SVG element
 *
 * @returns measurement data with a cloned SVG, or null if no SVG is present
 *
 * @example
 * ```ts
 * const info = measureSvgOverlay({ container, overlay });
 * ```
 */
export function measureSvgOverlay({
  container,
  overlay,
}: {
  container: HTMLDivElement;
  overlay: HTMLDivElement;
},): SvgOverlayInfo | null {
  /** SVG element from the overlay, if present */
  const svgElement = overlay.querySelector<SVGSVGElement>(':scope > svg',);
  if (svgElement === null)
    return null;

  /** Container position for offset calculation */
  const containerRect = container.getBoundingClientRect();
  /** Rendered SVG position and dimensions */
  const svgRect = svgElement.getBoundingClientRect();

  /** Detached copy so the caller can embed the SVG without mutating the live DOM node. */
  const cloneNode = svgElement.cloneNode(true,);
  if (!(cloneNode instanceof SVGSVGElement))
    throw new Error('SVG clone is not an SVGSVGElement',);

  return {
    clone: cloneNode,
    offsetX: svgRect.left - containerRect.left,
    offsetY: svgRect.top - containerRect.top,
    width: svgRect.width,
    height: svgRect.height,
  };
}
