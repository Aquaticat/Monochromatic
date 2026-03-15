/**
 * Canvas drawing state and rendering for the doodle widget.
 *
 * Manages stroke data as normalized [0..1] coordinate pairs so strokes
 * persist through canvas resizes. Provides functions for pointer event
 * handling and full canvas redraws.
 *
 * Exceeds 100 lines: cohesive drawing state, type definitions, and
 * rendering logic that share private module state and cannot be
 * meaningfully split further.
 */

//region Types

/** Normalized coordinate pair [x, y] in [0..1] range */
export type NormalizedPoint = readonly [number, number,];

/** Sequence of normalized points forming one continuous stroke */
export type NormalizedStroke = NormalizedPoint[];

/**
 * Line segment between two normalized points for incremental rendering.
 *
 * @example
 * ```ts
 * const segment = continueStroke(point);
 * if (segment !== null) {
 *   ctx.moveTo(segment.from[0] * width, segment.from[1] * height);
 *   ctx.lineTo(segment.to[0] * width, segment.to[1] * height);
 * }
 * ```
 */
export type StrokeSegment = {
  /** Starting point of the segment */
  readonly from: NormalizedPoint;
  /** Ending point of the segment */
  readonly to: NormalizedPoint;
};

//endregion Types

//region Constants

/** Stroke color in OKLCH color space */
const STROKE_COLOR = 'oklch(0.6 0.25 27)';

/** Stroke width in CSS pixels */
const STROKE_WIDTH = 10;

//endregion Constants

//region State

/** All completed and in-progress strokes */
let strokes: NormalizedStroke[] = [];

/** Stroke currently being drawn, or null when idle */
let current: NormalizedStroke | null = null;

/** Whether a pointer-driven drawing gesture is active */
let drawing = false;

//endregion State

/**
 * Configures a 2D rendering context with the drawing stroke style.
 *
 * @param ctx - canvas rendering context to configure
 */
export function configureCtx(ctx: CanvasRenderingContext2D,): void {
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/**
 * Redraws all stored strokes onto the canvas.
 *
 * Clears the canvas and renders each stroke using denormalized
 * coordinates based on current canvas dimensions.
 *
 * @param ctx - canvas rendering context
 *
 * @param cw - current canvas width in CSS pixels
 *
 * @param ch - current canvas height in CSS pixels
 */
export function redraw(
  { ctx, cw, ch, }: { ctx: CanvasRenderingContext2D; cw: number; ch: number; },
): void {
  ctx.clearRect(0, 0, cw, ch,);
  configureCtx(ctx,);
  for (const stroke of strokes) {
    if (stroke.length < 2)
      continue;
    ctx.beginPath();
    for (const [index, point,] of stroke.entries()) {
      if (index === 0)
        ctx.moveTo(point[0] * cw, point[1] * ch,);
      else
        ctx.lineTo(point[0] * cw, point[1] * ch,);
    }
    ctx.stroke();
  }
}

/**
 * Converts pointer event coordinates to normalized [0..1] canvas coordinates.
 *
 * @param event - pointer event with client coordinates
 *
 * @param canvas - canvas element for bounding rect calculation
 *
 * @param cw - current canvas width in CSS pixels
 *
 * @param ch - current canvas height in CSS pixels
 *
 * @returns normalized [x, y] coordinate pair
 */
export function normalizePointer({ event, canvas, cw, ch, }: {
  event: PointerEvent;
  canvas: HTMLCanvasElement;
  cw: number;
  ch: number;
},): NormalizedPoint {
  const rect = canvas.getBoundingClientRect();
  return [(event.clientX - rect.left) / cw, (event.clientY - rect.top) / ch,];
}

/**
 * Begins a new stroke at the given normalized point.
 *
 * @param point - starting coordinate in normalized [0..1] space
 */
export function startStroke(point: NormalizedPoint,): void {
  drawing = true;
  current = [point,];
  strokes.push(current,);
}

/**
 * Appends a point to the current stroke.
 *
 * @param point - coordinate to append in normalized [0..1] space
 *
 * @returns segment from previous to current point for incremental
 *   rendering, or null if no drawing gesture is active
 */
export function continueStroke(point: NormalizedPoint,): StrokeSegment | null {
  if (!drawing || current === null)
    return null;
  const previous = current.at(-1,);
  if (previous === undefined)
    return null;
  current.push(point,);
  return { from: previous, to: point, };
}

/**
 * Ends the current drawing gesture.
 */
export function endStroke(): void {
  drawing = false;
  current = null;
}

/**
 * Clears all stored strokes.
 */
export function clearStrokes(): void {
  strokes = [];
  current = null;
}
