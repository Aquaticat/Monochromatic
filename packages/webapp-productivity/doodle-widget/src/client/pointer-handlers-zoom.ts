/**
 * Zoom tool pointer event handlers for the doodle widget.
 *
 * Handles click-to-zoom, drag-to-pan, shift-to-zoom-out, and
 * long-press-to-zoom-out gestures when the zoom tool is active.
 */

import type { PointerHandlerDeps, } from './pointer-handler-deps.ts';
import {
  continuePan,
  endPan,
  startPan,
} from './zoom-pan.ts';
import { getPanX, getPanY, zoomAt, } from './zoom.ts';

/** Hold duration in milliseconds to trigger long-press zoom-out */
const LONG_PRESS_MS = 500;

/**
 * Attaches zoom-specific pointer and keyboard handlers to the canvas.
 *
 * @param deps - shared state and element references
 */
export function setupZoomPointerHandlers(deps: PointerHandlerDeps,): void {
  const { canvas, getToolMode, getCanvasSize, container, zoomLayer, } = deps;

  /** Timer id for the long-press gesture (mobile zoom-out) */
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether a long-press already fired for the current gesture */
  let longPressFired = false;

  /** Stored pointer event for long-press zoom-out position */
  let downEvent: PointerEvent | null = null;

  /**
   * Sets the canvas cursor based on current zoom tool state.
   *
   * @param style - CSS cursor keyword to apply
   */
  function setZoomCursor(style: string,): void {
    canvas.style.cursor = style;
  }

  /** Cancels any pending long-press timer */
  function clearLongPress(): void {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer,);
      longPressTimer = null;
    }
  }

  canvas.addEventListener('pointerdown',
    function handleZoomPointerDown(event: PointerEvent,): void {
      if (getToolMode() !== 'zoom')
        return;
      canvas.setPointerCapture(event.pointerId,);
      startPan({ event, currentPanX: getPanX(), currentPanY: getPanY(), },);
      downEvent = event;
      longPressFired = false;
      clearLongPress();
      longPressTimer = setTimeout(function fireLongPress(): void {
        longPressFired = true;
        longPressTimer = null;
        if (downEvent === null)
          return;
        const containerRect = container.getBoundingClientRect();
        const { cw, ch, } = getCanvasSize();
        zoomAt({
          screenX: downEvent.clientX - containerRect.left,
          screenY: downEvent.clientY - containerRect.top,
          direction: 'out',
          containerWidth: cw,
          containerHeight: ch,
          zoomLayer,
        },);
      }, LONG_PRESS_MS,);
    },);

  canvas.addEventListener('pointermove',
    function handleZoomPointerMove(event: PointerEvent,): void {
      if (getToolMode() !== 'zoom')
        return;
      const { cw, ch, } = getCanvasSize();
      const dragging = continuePan({ event, containerWidth: cw, containerHeight: ch, zoomLayer, },);
      if (dragging) {
        clearLongPress();
        setZoomCursor('move',);
      }
    },);

  canvas.addEventListener('pointerup',
    function handleZoomPointerUp(event: PointerEvent,): void {
      if (getToolMode() !== 'zoom')
        return;
      clearLongPress();
      const wasDrag = endPan();
      if (!wasDrag && !longPressFired) {
        const containerRect = container.getBoundingClientRect();
        const { cw, ch, } = getCanvasSize();
        zoomAt({
          screenX: event.clientX - containerRect.left,
          screenY: event.clientY - containerRect.top,
          direction: event.shiftKey ? 'out' : 'in',
          containerWidth: cw,
          containerHeight: ch,
          zoomLayer,
        },);
      }
      downEvent = null;
      setZoomCursor(event.shiftKey ? 'zoom-out' : 'zoom-in',);
    },);

  canvas.addEventListener('pointercancel',
    function handleZoomPointerCancel(): void {
      clearLongPress();
      endPan();
      downEvent = null;
    },);

  //region Shift key cursor toggle

  document.addEventListener('keydown',
    function handleZoomKeyDown(event: KeyboardEvent,): void {
      if (getToolMode() === 'zoom' && event.key === 'Shift')
        setZoomCursor('zoom-out',);
    },);

  document.addEventListener('keyup',
    function handleZoomKeyUp(event: KeyboardEvent,): void {
      if (getToolMode() === 'zoom' && event.key === 'Shift')
        setZoomCursor('zoom-in',);
    },);

  //endregion Shift key cursor toggle
}
