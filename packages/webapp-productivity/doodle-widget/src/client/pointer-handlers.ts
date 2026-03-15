/**
 * Pointer event handlers for the doodle widget canvas.
 *
 * Translates pointer events into drawing strokes (draw mode)
 * or text input placement (text mode) based on the active tool.
 */
import {
  configureCtx,
  continueStroke,
  endStroke,
  normalizePointer,
  startStroke,
} from './drawing.ts';
import { placeTextInput, } from './text.ts';

/**
 * Dependencies for pointer event handlers.
 *
 * @example
 * ```ts
 * setupPointerHandlers({
 *   canvas,
 *   ctx,
 *   isDrawMode,
 *   getCanvasSize: () => ({ cw: canvasWidth, ch: canvasHeight }),
 * });
 * ```
 */
export type PointerHandlerDeps = {
  /** Canvas element receiving pointer events */
  canvas: HTMLCanvasElement;
  /** 2D rendering context for immediate stroke rendering */
  ctx: CanvasRenderingContext2D;
  /** Returns `true` when draw tool is active, `false` for text tool */
  isDrawMode: () => boolean;
  /** Returns current canvas dimensions in CSS pixels */
  getCanvasSize: () => { cw: number; ch: number };
};

/**
 * Attaches pointerdown, pointermove, pointerup, and pointercancel
 * handlers to the canvas element.
 *
 * @param deps - shared state and element references
 *
 * @example
 * ```ts
 * setupPointerHandlers({ canvas, ctx, isDrawMode, getCanvasSize });
 * ```
 */
export function setupPointerHandlers(deps: PointerHandlerDeps): void {
  const { canvas, ctx, isDrawMode, getCanvasSize } = deps;

  canvas.addEventListener('pointerdown', function handlePointerDown(event: PointerEvent): void {
    if (!isDrawMode()) {
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
      const { cw, ch } = getCanvasSize();
      placeTextInput([
        (event.clientX - rect.left) / cw,
        (event.clientY - rect.top) / ch,
      ]);
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    const { cw, ch } = getCanvasSize();
    /** Normalized pointer position at stroke start */
    const point = normalizePointer({ event, canvas, cw, ch, });
    startStroke(point);
  });

  canvas.addEventListener('pointermove', function handlePointerMove(event: PointerEvent): void {
    if (!isDrawMode()) {
      return;
    }

    const { cw, ch } = getCanvasSize();
    /** Normalized pointer position for stroke continuation */
    const point = normalizePointer({ event, canvas, cw, ch, });
    /** Line segment to draw incrementally, or null if not drawing */
    const segment = continueStroke(point);
    if (segment === null) {
      return;
    }
    configureCtx(ctx);
    ctx.beginPath();
    ctx.moveTo(segment.from[0] * cw, segment.from[1] * ch);
    ctx.lineTo(segment.to[0] * cw, segment.to[1] * ch);
    ctx.stroke();
  });

  canvas.addEventListener('pointerup', function handlePointerUp(): void {
    if (isDrawMode()) {
      endStroke();
    }
  });

  canvas.addEventListener('pointercancel', function handlePointerCancel(): void {
    if (isDrawMode()) {
      endStroke();
    }
  });
}
