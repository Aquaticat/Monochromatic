/**
 * Pointer event handlers for the doodle widget canvas.
 *
 * Translates pointer events into drawing strokes (draw mode),
 * text input placement (text mode), or erasure (erase mode)
 * based on the active tool.
 */
import {
  type NormalizedPoint,
  continueStroke,
  endStroke,
  normalizePointer,
  redraw,
  startStroke,
} from './drawing.ts';
import {
  getStrokeColor,
  getStrokeWidth,
} from './drawing-config.ts';
import { eraseStrokesAt, } from './eraser-strokes.ts';
import { eraseTextAt, } from './eraser-text.ts';
import type { PointerHandlerDeps, } from './pointer-handler-deps.ts';
import { placeTextInput, } from './text.ts';

export type { ToolMode, } from './pointer-handler-deps.ts';

/**
 * Attaches pointerdown, pointermove, pointerup, and pointercancel
 * handlers to the canvas element.
 *
 * @param deps - shared state and element references
 *
 * @example
 * ```ts
 * setupPointerHandlers({ canvas, ctx, getToolMode, getCanvasSize, textLayer });
 * ```
 */
export function setupPointerHandlers(deps: PointerHandlerDeps,): void {
  const { canvas, ctx, getToolMode, getCanvasSize, textLayer, pushSnapshot, } = deps;

  /** Whether an erase gesture is currently active */
  let erasing = false;

  /** Whether any content was erased during the current gesture */
  let erasedInGesture = false;

  /** Previous eraser position for segment-based hit testing */
  let prevErasePoint: NormalizedPoint | null = null;

  canvas.addEventListener('pointerdown',
    function handlePointerDown(event: PointerEvent,): void {
      const mode = getToolMode();

      if (mode === 'text') {
        /**
         * Suppress the browser's default pointerdown focus-management.
         *
         * Without this, the sequence is: pointerdown fires -> placeTextInput
         * creates an input and calls focus() -> the browser's *default*
         * pointerdown handling then moves focus back to the canvas target ->
         * blur fires on the still-empty input -> finalizeActiveInput removes
         * it. The input appears and disappears within a single click.
         */
        event.preventDefault();
        /** Bounding rect of the canvas element */
        const rect = canvas.getBoundingClientRect();
        const { cw, ch, } = getCanvasSize();
        placeTextInput([
          (event.clientX - rect.left) / cw,
          (event.clientY - rect.top) / ch,
        ],);
        return;
      }

      canvas.setPointerCapture(event.pointerId,);
      const { cw, ch, } = getCanvasSize();
      /** Normalized pointer position */
      const point = normalizePointer({ event, canvas, cw, ch, },);

      if (mode === 'erase') {
        erasing = true;
        erasedInGesture = false;
        prevErasePoint = null;
        const strokeErased = eraseStrokesAt({ point, previousPoint: null, cw, ch, },);
        const textErased = eraseTextAt({ point, previousPoint: null, cw, ch, textLayer, },);
        if (strokeErased || textErased)
          erasedInGesture = true;
        if (strokeErased)
          redraw({ ctx, cw, ch, },);
        prevErasePoint = point;
        return;
      }

      startStroke(point,);
    },);

  canvas.addEventListener('pointermove',
    function handlePointerMove(event: PointerEvent,): void {
      const mode = getToolMode();
      const { cw, ch, } = getCanvasSize();
      /** Normalized pointer position */
      const point = normalizePointer({ event, canvas, cw, ch, },);

      if (mode === 'erase') {
        if (!erasing)
          return;
        const strokeErased = eraseStrokesAt({
          point, previousPoint: prevErasePoint, cw, ch,
        },);
        const textErased = eraseTextAt({
          point, previousPoint: prevErasePoint, cw, ch, textLayer,
        },);
        if (strokeErased || textErased)
          erasedInGesture = true;
        if (strokeErased)
          redraw({ ctx, cw, ch, },);
        prevErasePoint = point;
        return;
      }

      if (mode !== 'draw')
        return;

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
    },);

  /** Resets all gesture state (draw, erase) at pointer release */
  function endGesture(): void {
    endStroke();
    erasing = false;
    erasedInGesture = false;
    prevErasePoint = null;
  }

  canvas.addEventListener('pointerup', function handlePointerUp(): void {
    const mode = getToolMode();
    if (mode === 'draw' || (mode === 'erase' && erasedInGesture))
      pushSnapshot();
    endGesture();
  },);

  canvas.addEventListener('pointercancel', endGesture,);
}
