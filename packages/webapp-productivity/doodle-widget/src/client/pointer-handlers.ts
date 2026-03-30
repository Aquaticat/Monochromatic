/**
 * Pointer event handlers for the doodle widget canvas.
 *
 * Translates pointer events into drawing strokes (draw mode),
 * text input placement (text mode), or erasure (erase mode)
 * based on the active tool. Zoom is handled separately in
 * {@link import('./pointer-handlers-zoom.ts')}.
 */
import {
  getStrokeColor,
  getStrokeWidth,
} from './drawing-config.ts';
import {
  continueStroke,
  endStroke,
  type NormalizedPoint,
  normalizePointer,
  redraw,
  startStroke,
} from './drawing.ts';
import { eraseStrokesAt, } from './eraser-strokes.ts';
import { eraseTextAt, } from './eraser-text.ts';
import type { PointerHandlerDeps, } from './pointer-handler-deps.ts';
import { placeTextInput, } from './text.ts';

export type { ToolMode, } from './pointer-handler-deps.ts';

/**
 * Attaches pointerdown, pointermove, pointerup, and pointercancel
 * handlers to the canvas for draw, erase, and text tools.
 *
 * @param deps - shared state and element references
 */
export function setupPointerHandlers(deps: PointerHandlerDeps,): void {
  const {
    canvas,
    ctx,
    getToolMode,
    getCanvasSize,
    textLayer,
    pushSnapshot,
  } = deps;

  /** Whether an erase gesture is currently active */
  let erasing = false;

  /** Whether any content was erased during the current gesture */
  let erasedInGesture = false;

  /** Previous eraser position for segment-based hit testing */
  let prevErasePoint: NormalizedPoint | null = null;

  canvas.addEventListener(
    'pointerdown',
    function handlePointerDown(event: PointerEvent,): void {
      const mode = getToolMode();
      if (mode === 'zoom')
        return;

      if (mode === 'text') {
        /** Suppress default focus-management so the created input keeps focus */
        event.preventDefault();
        placeTextInput(normalizePointer({ event, canvas, },),);
        return;
      }

      canvas.setPointerCapture(event.pointerId,);
      const { cw, ch, } = getCanvasSize();
      const point = normalizePointer({ event, canvas, },);

      if (mode === 'erase') {
        erasing = true;
        erasedInGesture = false;
        prevErasePoint = null;
        const strokeErased = eraseStrokesAt({ point, previousPoint: null, cw, ch, },);
        const textErased = eraseTextAt({ point, previousPoint: null, cw, ch,
          textLayer, },);
        if (strokeErased || textErased)
          erasedInGesture = true;
        if (strokeErased)
          redraw({ ctx, cw, ch, },);
        prevErasePoint = point;
        return;
      }

      startStroke(point,);
    },
  );

  canvas.addEventListener(
    'pointermove',
    function handlePointerMove(event: PointerEvent,): void {
      const mode = getToolMode();
      if (mode === 'zoom' || mode === 'text')
        return;

      const { cw, ch, } = getCanvasSize();
      const point = normalizePointer({ event, canvas, },);

      if (mode === 'erase') {
        if (!erasing)
          return;
        const strokeErased = eraseStrokesAt({ point, previousPoint: prevErasePoint, cw,
          ch, },);
        const textErased = eraseTextAt({ point, previousPoint: prevErasePoint, cw, ch,
          textLayer, },);
        if (strokeErased || textErased)
          erasedInGesture = true;
        if (strokeErased)
          redraw({ ctx, cw, ch, },);
        prevErasePoint = point;
        return;
      }

      /** Line segment to draw incrementally, or null if not drawing */
      const segment = continueStroke(point,);
      if (segment === null)
        return;
      ctx.strokeStyle = getStrokeColor();
      ctx.lineWidth = getStrokeWidth();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(segment.from[0] * cw, segment.from[1] * ch,);
      ctx.lineTo(segment.to[0] * cw, segment.to[1] * ch,);
      ctx.stroke();
    },
  );

  /** Resets draw/erase gesture state at pointer release */
  function endGesture(): void {
    endStroke();
    erasing = false;
    erasedInGesture = false;
    prevErasePoint = null;
  }

  canvas.addEventListener(
    'pointerup',
    function handlePointerUp(): void {
      const mode = getToolMode();
      if (mode === 'zoom')
        return;
      if (mode === 'draw' || (mode === 'erase' && erasedInGesture))
        pushSnapshot();
      endGesture();
    },
  );

  canvas.addEventListener(
    'pointercancel',
    endGesture,
  );
}
