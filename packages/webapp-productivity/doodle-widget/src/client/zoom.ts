/**
 * Zoom state and CSS transform application for the doodle widget canvas.
 *
 * Tracks zoom scale and pan offset. Zoom is purely visual via CSS
 * transforms on a wrapper element; content coordinates are unchanged.
 */

//region Constants

/** Minimum zoom scale (no zoom-out past original size) */
const MIN_SCALE = 1;

/** Maximum zoom scale */
const MAX_SCALE = 8;

/** Zoom step multiplier per click */
const ZOOM_STEP = 2;

//endregion Constants

//region State

/** Current zoom scale (1 = no zoom) */
let scale = 1;

/** Pan offset X in CSS pixels relative to container */
let panX = 0;

/** Pan offset Y in CSS pixels relative to container */
let panY = 0;

//endregion State

/**
 * Returns the current zoom scale.
 *
 * @returns zoom scale where 1 means no zoom
 */
export function getScale(): number {
  return scale;
}

/**
 * Returns the current pan X offset.
 *
 * @returns pan X in CSS pixels
 */
export function getPanX(): number {
  return panX;
}

/**
 * Returns the current pan Y offset.
 *
 * @returns pan Y in CSS pixels
 */
export function getPanY(): number {
  return panY;
}

/**
 * Applies the current zoom and pan as a CSS transform on the zoom layer.
 *
 * Clears the transform entirely at default zoom (scale 1) to
 * avoid unnecessary compositing layers.
 *
 * @param zoomLayer - container element for zoomed content
 */
export function applyZoomTransform(zoomLayer: HTMLElement,): void {
  if (scale === 1) {
    zoomLayer.style.transform = '';
    return;
  }
  zoomLayer.style.transformOrigin = '0 0';
  zoomLayer.style.transform = `translate(${String(panX,)}px, ${String(panY,)}px) scale(${String(scale,)})`;
}

/**
 * Clamps pan offset so content always covers the container viewport.
 *
 * @param containerWidth - container width in CSS pixels
 *
 * @param containerHeight - container height in CSS pixels
 */
export function clampPan({ containerWidth, containerHeight, }: {
  containerWidth: number;
  containerHeight: number;
}): void {
  if (scale <= 1) {
    panX = 0;
    panY = 0;
    return;
  }
  panX = Math.max(-(scale - 1) * containerWidth, Math.min(0, panX,),);
  panY = Math.max(-(scale - 1) * containerHeight, Math.min(0, panY,),);
}

/**
 * Sets the pan offset directly, called by the pan gesture module.
 *
 * @param x - new pan X offset in CSS pixels
 *
 * @param y - new pan Y offset in CSS pixels
 */
export function setPan({ x, y, }: { x: number; y: number; }): void {
  panX = x;
  panY = y;
}

/**
 * Zooms in or out centered on a screen-space point relative to the container.
 *
 * Adjusts pan offset so the content point under the cursor stays
 * stationary after the scale change.
 *
 * @param screenX - pointer X relative to container left edge
 *
 * @param screenY - pointer Y relative to container top edge
 *
 * @param direction - 'in' to zoom in, 'out' to zoom out
 *
 * @param containerWidth - container width in CSS pixels
 *
 * @param containerHeight - container height in CSS pixels
 *
 * @param zoomLayer - element to apply CSS transform to
 */
export function zoomAt({ screenX, screenY, direction, containerWidth, containerHeight, zoomLayer, }: {
  screenX: number;
  screenY: number;
  direction: 'in' | 'out';
  containerWidth: number;
  containerHeight: number;
  zoomLayer: HTMLElement;
}): void {
  const factor = direction === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor,),);
  if (newScale === scale)
    return;
  /** Ratio between new and old scale for pan adjustment */
  const actualFactor = newScale / scale;
  panX = screenX * (1 - actualFactor) + panX * actualFactor;
  panY = screenY * (1 - actualFactor) + panY * actualFactor;
  scale = newScale;
  clampPan({ containerWidth, containerHeight, },);
  applyZoomTransform(zoomLayer,);
}

/**
 * Resets zoom to 1x with no pan offset.
 *
 * @param zoomLayer - element to clear CSS transform from
 */
export function resetZoom(zoomLayer: HTMLElement,): void {
  scale = 1;
  panX = 0;
  panY = 0;
  applyZoomTransform(zoomLayer,);
}

/**
 * Re-clamps pan after a container resize and reapplies the transform.
 *
 * @param containerWidth - new container width in CSS pixels
 *
 * @param containerHeight - new container height in CSS pixels
 *
 * @param zoomLayer - element to apply CSS transform to
 */
export function refreshZoomTransform({ containerWidth, containerHeight, zoomLayer, }: {
  containerWidth: number;
  containerHeight: number;
  zoomLayer: HTMLElement;
}): void {
  clampPan({ containerWidth, containerHeight, },);
  applyZoomTransform(zoomLayer,);
}
