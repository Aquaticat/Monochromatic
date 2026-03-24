/**
 * Pan drag gesture handling for the doodle widget zoom tool.
 *
 * Tracks pointer movement during a drag and updates the zoom
 * pan offset. Distinguishes clicks from drags via a distance
 * threshold so that small-movement clicks still register as zooms.
 */

import {
  applyZoomTransform,
  clampPan,
  setPan,
} from './zoom.ts';

/** Minimum pointer movement in pixels to distinguish drag from click */
const DRAG_THRESHOLD = 4;

//region State

/** Whether a pan drag gesture is active */
let panning = false;

/** Pointer X at pan start in screen pixels */
let panStartPointerX = 0;

/** Pointer Y at pan start in screen pixels */
let panStartPointerY = 0;

/** Pan offset X at drag start */
let panStartOffsetX = 0;

/** Pan offset Y at drag start */
let panStartOffsetY = 0;

/** Whether pointer moved enough to count as drag (not click) */
let dragExceededThreshold = false;

//endregion State

/**
 * Begins a pan drag gesture at the given pointer position.
 *
 * @param event - pointer event that started the drag
 *
 * @param currentPanX - current pan X offset to snapshot
 *
 * @param currentPanY - current pan Y offset to snapshot
 */
export function startPan({ event, currentPanX, currentPanY, }: {
  event: PointerEvent;
  currentPanX: number;
  currentPanY: number;
},): void {
  panning = true;
  dragExceededThreshold = false;
  panStartPointerX = event.clientX;
  panStartPointerY = event.clientY;
  panStartOffsetX = currentPanX;
  panStartOffsetY = currentPanY;
}

/**
 * Continues a pan drag gesture, updating the pan offset.
 *
 * @param event - pointer move event
 *
 * @param containerWidth - container width in CSS pixels
 *
 * @param containerHeight - container height in CSS pixels
 *
 * @param zoomLayer - element to apply CSS transform to
 *
 * @returns whether the pointer has moved enough to count as a drag
 */
export function continuePan({ event, containerWidth, containerHeight, zoomLayer, }: {
  event: PointerEvent;
  containerWidth: number;
  containerHeight: number;
  zoomLayer: HTMLElement;
},): boolean {
  if (!panning)
    return false;

  const dx = event.clientX - panStartPointerX;
  const dy = event.clientY - panStartPointerY;

  if (!dragExceededThreshold) {
    if (Math.abs(dx,) > DRAG_THRESHOLD || Math.abs(dy,) > DRAG_THRESHOLD)
      dragExceededThreshold = true;
    else
      return false;
  }

  setPan({ x: panStartOffsetX + dx, y: panStartOffsetY + dy, },);
  clampPan({ containerWidth, containerHeight, },);
  applyZoomTransform(zoomLayer,);
  return true;
}

/**
 * Ends a pan drag gesture.
 *
 * @returns whether the gesture was a drag (moved beyond threshold) or a click
 */
export function endPan(): boolean {
  panning = false;
  const wasDrag = dragExceededThreshold;
  dragExceededThreshold = false;
  return wasDrag;
}
