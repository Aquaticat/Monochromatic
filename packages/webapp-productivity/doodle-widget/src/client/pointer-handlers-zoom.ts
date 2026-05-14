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
import {
  getPanX,
  getPanY,
  zoomAt,
} from './zoom.ts';

/** Hold duration in milliseconds to trigger long-press zoom-out */
const LONG_PRESS_MS = 500;

/**
 * Attaches zoom-specific pointer and keyboard handlers to the canvas.
 *
 * @param deps - shared state and element references
 *
 * @example
 * ```ts
 * setupZoomPointerHandlers(deps);
 * ```
 */
export function setupZoomPointerHandlers(deps: PointerHandlerDeps,): void {
  /** Destructured up front so each handler closure captures the same handles. */
  const {
    canvas,
    getToolMode,
    getCanvasSize,
    page,
    zoomLayer,
  } = deps;

  /**
   * Per-gesture mutable state container.
   *
   * Stored as object properties so function-root state stays in a `const`
   * container (`no-function-root-let` would otherwise reject top-level `let`).
   */
  const gestureState: {
    longPressTimer: ReturnType<typeof setTimeout> | null;
    longPressFired: boolean;
    downEvent: PointerEvent | null;
  } = {
    longPressTimer: null,
    longPressFired: false,
    downEvent: null,
  };

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
    if (gestureState.longPressTimer !== null) {
      clearTimeout(gestureState.longPressTimer,);
      gestureState.longPressTimer = null;
    }
  }

  canvas.addEventListener(
    'pointerdown',
    function handleZoomPointerDown(event: PointerEvent,): void {
      if (getToolMode() !== 'zoom')
        return;
      /** Prevent iOS Safari from cancelling the pointer sequence via native gesture recognition */
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId,);
      startPan({
        event,
        currentPanX: getPanX(),
        currentPanY: getPanY(),
      },);
      gestureState.downEvent = event;
      gestureState.longPressFired = false;
      clearLongPress();
      gestureState.longPressTimer = setTimeout(
        function fireLongPress(): void {
          gestureState.longPressFired = true;
          gestureState.longPressTimer = null;
          if (gestureState.downEvent === null)
            return;
          /** Container layout captured per gesture so panning offsets stay consistent across reflows. */
          const containerRect = page.getBoundingClientRect();
          /** Canvas dimensions resolved here so the zoom math uses fresh sizing. */
          const {
            cw,
            ch,
          } = getCanvasSize();
          zoomAt({
            screenX: gestureState.downEvent.clientX - containerRect.left,
            screenY: gestureState.downEvent.clientY - containerRect.top,
            direction: 'out',
            containerWidth: cw,
            containerHeight: ch,
            zoomLayer,
          },);
        },
        LONG_PRESS_MS,
      );
    },
  );

  canvas.addEventListener(
    'pointermove',
    function handleZoomPointerMove(event: PointerEvent,): void {
      if (getToolMode() !== 'zoom')
        return;
      /** Canvas dimensions resolved each move so pan math stays in sync with the live layout. */
      const {
        cw,
        ch,
      } = getCanvasSize();
      /** True only when the pointer has crossed the drag threshold, so the cursor flip is conditional. */
      const dragging = continuePan({
        event,
        containerWidth: cw,
        containerHeight: ch,
        zoomLayer,
      },);
      if (dragging) {
        clearLongPress();
        setZoomCursor('move',);
      }
    },
  );

  canvas.addEventListener(
    'pointerup',
    function handleZoomPointerUp(event: PointerEvent,): void {
      if (getToolMode() !== 'zoom')
        return;
      clearLongPress();
      /** True when the gesture moved past the drag threshold; suppresses the tap-to-zoom action. */
      const wasDrag = endPan();
      if ((!wasDrag) && (!gestureState.longPressFired)) {
        /** Container layout captured at release so the zoom origin matches the screen tap. */
        const containerRect = page.getBoundingClientRect();
        /** Canvas dimensions resolved at release so the zoom math uses fresh sizing. */
        const {
          cw,
          ch,
        } = getCanvasSize();
        zoomAt({
          screenX: event.clientX - containerRect.left,
          screenY: event.clientY - containerRect.top,
          direction: event.shiftKey ? 'out' : 'in',
          containerWidth: cw,
          containerHeight: ch,
          zoomLayer,
        },);
      }
      gestureState.downEvent = null;
      setZoomCursor(event.shiftKey ? 'zoom-out' : 'zoom-in',);
    },
  );

  canvas.addEventListener(
    'pointercancel',
    function handleZoomPointerCancel(): void {
      clearLongPress();
      endPan();
      gestureState.downEvent = null;
    },
  );

  //region iOS touch fallback
  /**
   * iOS Safari may not fully honor `touch-action: none` in CSS and can
   * fire `pointercancel` to take over touch handling for native gestures
   * (scroll, page zoom, context menu). Explicitly preventing default on
   * `touchstart` and `touchmove` stops this at the touch-event level,
   * before pointer events are generated.
   */

  canvas.addEventListener(
    'touchstart',
    function handleZoomTouchStart(event: TouchEvent,): void {
      if (getToolMode() === 'zoom')
        event.preventDefault();
    },
    { passive: false, },
  );

  canvas.addEventListener(
    'touchmove',
    function handleZoomTouchMove(event: TouchEvent,): void {
      if (getToolMode() === 'zoom')
        event.preventDefault();
    },
    { passive: false, },
  );

  //endregion iOS touch fallback

  //region Shift key cursor toggle

  document.addEventListener(
    'keydown',
    function handleZoomKeyDown(event: KeyboardEvent,): void {
      if ((getToolMode() === 'zoom') && (event.key === 'Shift'))
        setZoomCursor('zoom-out',);
    },
  );

  document.addEventListener(
    'keyup',
    function handleZoomKeyUp(event: KeyboardEvent,): void {
      if ((getToolMode() === 'zoom') && (event.key === 'Shift'))
        setZoomCursor('zoom-in',);
    },
  );

  //endregion Shift key cursor toggle
}
