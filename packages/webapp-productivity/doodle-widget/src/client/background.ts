/**
 * Background management for the doodle widget.
 *
 * Handles SVG and raster image backgrounds. SVG backgrounds have their
 * white background rectangles removed so canvas strokes show through
 * beneath the SVG paths. Raster backgrounds use object URLs for
 * efficient memory handling.
 */

//region State

/** Currently active object URL for raster backgrounds */
let activeObjectUrl: string | null = null;

//endregion State

/**
 * Revokes any active object URL to prevent memory leaks.
 */
function revokeActiveObjectUrl(): void {
  if (activeObjectUrl !== null) {
    URL.revokeObjectURL(activeObjectUrl,);
    activeObjectUrl = null;
  }
}

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
 * Removes the white background rectangle from the SVG, displays it
 * in the overlay, and sets a white container background. Revokes any
 * prior raster background object URL.
 *
 * @param svgMarkup - raw SVG markup to display
 *
 * @param overlay - SVG overlay element
 *
 * @param container - canvas container element
 */
export function setSvgBackground({ svgMarkup, overlay, container, }: {
  svgMarkup: string;
  overlay: HTMLElement;
  container: HTMLElement;
},): void {
  revokeActiveObjectUrl();
  const processed = removeSvgWhiteBackground(svgMarkup,);
  overlay.innerHTML = processed;
  overlay.style.display = '';
  container.style.backgroundImage = '';
  container.style.backgroundColor = 'oklch(1 0 0)';
}

/**
 * Sets a raster image file as the container background.
 *
 * Creates an object URL from the file, hides the SVG overlay, and
 * applies the image as a CSS background with a dark container
 * background for contrast. Revokes any prior object URL.
 *
 * @param file - image file to use as background
 *
 * @param overlay - SVG overlay element to hide
 *
 * @param container - canvas container element
 */
export function setRasterBackground({ file, overlay, container, }: {
  file: File;
  overlay: HTMLElement;
  container: HTMLElement;
},): void {
  revokeActiveObjectUrl();
  activeObjectUrl = URL.createObjectURL(file,);
  overlay.innerHTML = '';
  overlay.style.display = 'none';
  container.style.backgroundImage = `url("${activeObjectUrl}")`;
  container.style.backgroundSize = 'contain';
  container.style.backgroundPosition = 'center';
  container.style.backgroundRepeat = 'no-repeat';
  container.style.backgroundColor = 'oklch(0.15 0 0)';
}
